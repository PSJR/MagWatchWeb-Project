// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {IUniswapV3Factory, INonfungiblePositionManager, IWETH9} from "./interfaces/IUniswapV3.sol";

/**
 * @title SparkCurve — "a fogueira"
 * @notice Constant-product bonding curve over virtual reserves.
 *
 *   virtualBase  = virtualBase0  - baseSold
 *   virtualQuote = virtualQuote0 + quoteRaised
 *   baseOut  = virtualBase  * quoteIn / (virtualQuote + quoteIn)
 *   quoteOut = virtualQuote * baseIn  / (virtualBase  + baseIn)
 *
 * Those two forms are algebraically identical to `vb - k/(vq + dq)` but need no
 * division to derive reserves, so the arithmetic is exact in integers — there is
 * no fixed-point approximation anywhere in this contract. Rounding is always
 * floor on what the trader receives, which favours the curve.
 *
 * When quoteRaised reaches graduationRaise the curve closes forever and seeds a
 * full-range Uniswap V3 position with the remaining LP supply and everything it
 * raised. The position NFT stays in this contract and there is no code path that
 * can decrease or withdraw that liquidity — only `collectPoolFees` exists. That
 * is what "liquidez travada para sempre" means here, and it is enforced by the
 * absence of a function rather than by a promise.
 */
contract SparkCurve is ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;
    uint256 public constant LP_SUPPLY = 200_000_000 ether;
    uint256 public constant BPS = 10_000;

    uint24 public constant POOL_FEE = 10_000; // 1%
    int24 private constant TICK_SPACING = 200;
    int24 private constant MIN_TICK = -887_200; // full range for spacing 200
    int24 private constant MAX_TICK = 887_200;

    // ---- immutable configuration -------------------------------------------
    address public immutable token;
    /// @dev address(0) means the native coin (ETH) is the quote asset.
    address public immutable quoteToken;
    address public immutable creator;
    address public immutable treasury;

    uint256 public immutable virtualBase0;
    uint256 public immutable virtualQuote0;
    uint256 public immutable graduationRaise;
    /**
     * @dev Anti-sniping cap on cumulative *quote* spent per wallet, not on
     *      tokens received. A token-denominated cap is unusable here: early on
     *      the curve, tokens are so cheap that 2% of the supply costs ~0.06 ETH
     *      of a 12 ETH raise, which would cap every wallet at pocket change.
     *      Quote-denominated, the limit means the same thing anywhere on the
     *      curve and is explainable in one line. 0 = uncapped (Mayhem).
     */
    uint256 public immutable walletQuoteCap;
    uint16 public immutable creatorFeeBps;
    uint16 public immutable protocolFeeBps;
    bool public immutable mayhem;

    INonfungiblePositionManager public immutable positionManager;
    IUniswapV3Factory public immutable uniswapFactory;
    IWETH9 public immutable weth;

    // ---- mutable state ------------------------------------------------------
    uint256 public baseSold;
    uint256 public quoteRaised;
    uint256 public creatorFeesAccrued;
    uint256 public creatorFeesClaimed;
    uint256 public protocolFeesAccrued;
    bool public graduated;
    address public pool;
    uint256 public positionTokenId;

    /// @dev cumulative net quote spent per wallet, decremented on sells
    mapping(address => uint256) public quoteSpent;

    // ---- events -------------------------------------------------------------
    event Bought(address indexed buyer, uint256 quoteIn, uint256 baseOut, uint256 creatorFee, uint256 protocolFee, uint256 baseSold, uint256 quoteRaised);
    event Sold(address indexed seller, uint256 baseIn, uint256 quoteOut, uint256 creatorFee, uint256 protocolFee, uint256 baseSold, uint256 quoteRaised);
    event Graduated(address indexed pool, uint256 tokenId, uint256 baseLiquidity, uint256 quoteLiquidity, uint160 sqrtPriceX96);
    event CreatorFeesClaimed(address indexed to, uint256 amount);
    event ProtocolFeesClaimed(address indexed to, uint256 amount);
    event PoolFeesCollected(uint256 amount0, uint256 amount1);

    error AlreadyGraduated();
    error NotGraduated();
    error ZeroAmount();
    error SlippageExceeded(uint256 got, uint256 minimum);
    error WalletCapExceeded(uint256 attempted, uint256 cap);
    error InsufficientBalance();
    error TransferFailed();

    struct Config {
        address quoteToken;
        address creator;
        address treasury;
        uint256 virtualBase0;
        uint256 graduationRaise;
        uint256 walletQuoteCap;
        uint16 creatorFeeBps;
        uint16 protocolFeeBps;
        bool mayhem;
        address positionManager;
        address uniswapFactory;
        address weth;
    }

    constructor(Config memory cfg, address token_) {
        require(token_ != address(0), "token required");
        require(cfg.virtualBase0 > CURVE_SUPPLY, "curve unsolvable");
        require(cfg.creatorFeeBps + cfg.protocolFeeBps < BPS, "fees >= 100%");

        token = token_;
        quoteToken = cfg.quoteToken;
        creator = cfg.creator;
        treasury = cfg.treasury;
        virtualBase0 = cfg.virtualBase0;
        graduationRaise = cfg.graduationRaise;
        walletQuoteCap = cfg.walletQuoteCap;
        creatorFeeBps = cfg.creatorFeeBps;
        protocolFeeBps = cfg.protocolFeeBps;
        mayhem = cfg.mayhem;
        positionManager = INonfungiblePositionManager(cfg.positionManager);
        uniswapFactory = IUniswapV3Factory(cfg.uniswapFactory);
        weth = IWETH9(cfg.weth);

        // Derived so the curve lands exactly on graduationRaise at CURVE_SUPPLY.
        virtualQuote0 = (cfg.graduationRaise * (cfg.virtualBase0 - CURVE_SUPPLY)) / CURVE_SUPPLY;
        require(virtualQuote0 > 0, "quote reserve underflow");
    }

    // ---- views --------------------------------------------------------------

    function virtualBase() public view returns (uint256) {
        return virtualBase0 - baseSold;
    }

    function virtualQuote() public view returns (uint256) {
        return virtualQuote0 + quoteRaised;
    }

    /// @notice Curve completion in basis points (10000 = ready to graduate).
    function progressBps() external view returns (uint256) {
        if (quoteRaised >= graduationRaise) return BPS;
        return (quoteRaised * BPS) / graduationRaise;
    }

    function quoteToGraduate() external view returns (uint256) {
        return quoteRaised >= graduationRaise ? 0 : graduationRaise - quoteRaised;
    }

    /// @notice Tokens out for a gross quote amount, fees already deducted.
    function previewBuy(uint256 quoteIn)
        public view returns (uint256 baseOut, uint256 creatorFee, uint256 protocolFee, uint256 refund)
    {
        if (quoteIn == 0 || graduated) return (0, 0, 0, quoteIn);

        uint256 net = _netOf(quoteIn);
        uint256 vb = virtualBase();
        baseOut = (vb * net) / (virtualQuote() + net);

        uint256 remaining = CURVE_SUPPLY - baseSold;
        if (baseOut > remaining) {
            baseOut = remaining;
            // Invert the curve for exactly `remaining` tokens, rounding the
            // cost up so the curve never sells short.
            uint256 netNeeded = Math.mulDiv(baseOut, virtualQuote(), vb - baseOut, Math.Rounding.Ceil);
            uint256 grossNeeded = Math.mulDiv(netNeeded, BPS, BPS - creatorFeeBps - protocolFeeBps, Math.Rounding.Ceil);
            if (grossNeeded >= quoteIn) {
                grossNeeded = quoteIn;
            }
            refund = quoteIn - grossNeeded;
            quoteIn = grossNeeded;
        }

        creatorFee = (quoteIn * creatorFeeBps) / BPS;
        protocolFee = (quoteIn * protocolFeeBps) / BPS;
    }

    /// @notice Quote out for selling `baseIn` tokens, fees already deducted.
    function previewSell(uint256 baseIn)
        public view returns (uint256 quoteOut, uint256 creatorFee, uint256 protocolFee)
    {
        if (baseIn == 0 || graduated) return (0, 0, 0);
        if (baseIn > baseSold) baseIn = baseSold;

        uint256 gross = (virtualQuote() * baseIn) / (virtualBase() + baseIn);
        creatorFee = (gross * creatorFeeBps) / BPS;
        protocolFee = (gross * protocolFeeBps) / BPS;
        quoteOut = gross - creatorFee - protocolFee;
    }

    // ---- trading ------------------------------------------------------------

    /**
     * @param quoteIn   For ERC-20 quotes, the amount to pull. Ignored for ETH.
     * @param minBaseOut Slippage floor. Reverts rather than filling worse.
     */
    function buy(uint256 quoteIn, uint256 minBaseOut, address to)
        external payable nonReentrant returns (uint256 baseOut)
    {
        if (graduated) revert AlreadyGraduated();
        if (to == address(0)) to = msg.sender;

        uint256 amountIn = _receiveQuote(quoteIn);
        if (amountIn == 0) revert ZeroAmount();

        uint256 creatorFee;
        uint256 protocolFee;
        uint256 refund;
        (baseOut, creatorFee, protocolFee, refund) = previewBuy(amountIn);

        if (baseOut == 0) revert ZeroAmount();
        if (baseOut < minBaseOut) revert SlippageExceeded(baseOut, minBaseOut);

        uint256 spent = amountIn - refund;
        uint256 net = spent - creatorFee - protocolFee;

        if (walletQuoteCap != 0) {
            uint256 total = quoteSpent[to] + net;
            if (total > walletQuoteCap) revert WalletCapExceeded(total, walletQuoteCap);
            quoteSpent[to] = total;
        }

        baseSold += baseOut;
        quoteRaised += net;
        creatorFeesAccrued += creatorFee;
        protocolFeesAccrued += protocolFee;

        IERC20(token).safeTransfer(to, baseOut);
        if (refund > 0) _sendQuote(msg.sender, refund);

        emit Bought(to, spent, baseOut, creatorFee, protocolFee, baseSold, quoteRaised);

        if (quoteRaised >= graduationRaise || baseSold >= CURVE_SUPPLY) _graduate();
    }

    function sell(uint256 baseIn, uint256 minQuoteOut, address to)
        external nonReentrant returns (uint256 quoteOut)
    {
        if (graduated) revert AlreadyGraduated();
        if (baseIn == 0) revert ZeroAmount();
        if (to == address(0)) to = msg.sender;

        (uint256 out, uint256 creatorFee, uint256 protocolFee) = previewSell(baseIn);
        if (out < minQuoteOut) revert SlippageExceeded(out, minQuoteOut);

        uint256 gross = out + creatorFee + protocolFee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), baseIn);

        baseSold -= baseIn;
        quoteRaised -= gross;
        creatorFeesAccrued += creatorFee;
        protocolFeesAccrued += protocolFee;

        // Selling frees the allowance again so a capped token cannot be
        // permanently blocked by round-tripping.
        uint256 spentBefore = quoteSpent[msg.sender];
        quoteSpent[msg.sender] = spentBefore > gross ? spentBefore - gross : 0;

        _sendQuote(to, out);
        emit Sold(msg.sender, baseIn, out, creatorFee, protocolFee, baseSold, quoteRaised);
        return out;
    }

    // ---- fees ---------------------------------------------------------------

    function claimableCreatorFees() public view returns (uint256) {
        return creatorFeesAccrued - creatorFeesClaimed;
    }

    function claimCreatorFees() external nonReentrant returns (uint256 amount) {
        amount = claimableCreatorFees();
        if (amount == 0) revert ZeroAmount();
        creatorFeesClaimed += amount;
        _sendQuote(creator, amount);
        emit CreatorFeesClaimed(creator, amount);
    }

    function claimProtocolFees() external nonReentrant returns (uint256 amount) {
        amount = protocolFeesAccrued;
        if (amount == 0) revert ZeroAmount();
        protocolFeesAccrued = 0;
        _sendQuote(treasury, amount);
        emit ProtocolFeesClaimed(treasury, amount);
    }

    /// @notice Trading fees earned by the locked position. The liquidity itself
    ///         can never be withdrawn — there is no function that does it.
    function collectPoolFees() external nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (!graduated) revert NotGraduated();
        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionTokenId,
                recipient: creator,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        emit PoolFeesCollected(amount0, amount1);
    }

    // ---- graduation ---------------------------------------------------------

    function _graduate() private {
        graduated = true;

        uint256 quoteAmount = quoteRaised;
        uint256 baseAmount = LP_SUPPLY;

        address quote = quoteToken;
        if (quote == address(0)) {
            weth.deposit{value: quoteAmount}();
            quote = address(weth);
        }

        (address token0, address token1, uint256 amount0, uint256 amount1) =
            token < quote
                ? (token, quote, baseAmount, quoteAmount)
                : (quote, token, quoteAmount, baseAmount);

        uint160 sqrtPriceX96 = _sqrtPriceX96(amount0, amount1);

        pool = positionManager.createAndInitializePoolIfNecessary(token0, token1, POOL_FEE, sqrtPriceX96);

        IERC20(token0).forceApprove(address(positionManager), amount0);
        IERC20(token1).forceApprove(address(positionManager), amount1);

        (uint256 tokenId,, uint256 used0, uint256 used1) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        positionTokenId = tokenId;

        // Dust the pool would not take is burned rather than left claimable, so
        // the "locked forever" claim has no loophole.
        _burnDust(token0, amount0 - used0);
        _burnDust(token1, amount1 - used1);

        emit Graduated(pool, tokenId, baseAmount, quoteAmount, sqrtPriceX96);
    }

    /// @dev sqrt(amount1 / amount0) * 2^96, via 512-bit intermediate.
    function _sqrtPriceX96(uint256 amount0, uint256 amount1) private pure returns (uint160) {
        uint256 ratioX192 = Math.mulDiv(amount1, 1 << 192, amount0);
        uint256 root = Math.sqrt(ratioX192);
        require(root <= type(uint160).max, "price overflow");
        return uint160(root);
    }

    function _burnDust(address erc20, uint256 amount) private {
        if (amount == 0) return;
        IERC20(erc20).safeTransfer(address(0xdEaD), amount);
    }

    // ---- quote asset plumbing -----------------------------------------------

    function _netOf(uint256 gross) private view returns (uint256) {
        return gross - (gross * creatorFeeBps) / BPS - (gross * protocolFeeBps) / BPS;
    }

    function _receiveQuote(uint256 amount) private returns (uint256) {
        if (quoteToken == address(0)) {
            return msg.value;
        }
        require(msg.value == 0, "native not accepted");
        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), amount);
        return amount;
    }

    function _sendQuote(address to, uint256 amount) private {
        if (amount == 0) return;
        if (quoteToken == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(quoteToken).safeTransfer(to, amount);
        }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        // Only the WETH contract refunds ETH here (on withdraw); trades must go
        // through buy() so they cannot bypass slippage and cap checks.
        require(msg.sender == address(weth), "use buy()");
    }
}
