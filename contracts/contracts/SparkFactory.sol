// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {SparkToken} from "./SparkToken.sol";
import {SparkCurve} from "./SparkCurve.sol";

/**
 * @title SparkFactory
 * @notice Lights tokens. One call deploys the ERC-20 and its bonding curve,
 *         moves the whole supply into the curve, and optionally performs the
 *         creator's opening buy in the same transaction.
 *
 * Curve parameters are fixed per pair here rather than passed in, so a creator
 * cannot launch a token with fees or a graduation target of their own choosing.
 */
contract SparkFactory is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;
    uint256 public constant STANDARD_VIRTUAL_BASE = 1_073_000_000 ether;
    /// @dev Mayhem steepens the curve. The floor is CURVE_SUPPLY: below it the
    ///      curve has no solution. 85% keeps a deliberate margin.
    uint256 public constant MAYHEM_VIRTUAL_BASE = (1_073_000_000 ether * 85) / 100;

    uint16 public constant STANDARD_CREATOR_FEE_BPS = 100; // 1.0%
    uint16 public constant MAYHEM_CREATOR_FEE_BPS = 250;   // 2.5%
    uint16 public constant PROTOCOL_FEE_BPS = 50;          // 0.5%
    /// @dev Anti-sniping cap per wallet, as a share of the graduation target.
    ///      10% means a token needs at least ten wallets to graduate.
    uint16 public constant WALLET_CAP_BPS = 1_000;

    struct QuoteConfig {
        bool enabled;
        uint256 graduationRaise;
    }

    address public immutable positionManager;
    address public immutable uniswapFactory;
    address public immutable weth;

    address public treasury;
    /// @dev quote token address (address(0) = native ETH) => config
    mapping(address => QuoteConfig) public quotes;

    address[] public allCurves;
    mapping(address => address) public curveOfToken;

    event TokenLaunched(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        address quoteToken,
        bool mayhem,
        string metadataURI
    );
    event QuoteConfigured(address indexed quoteToken, bool enabled, uint256 graduationRaise);
    event TreasuryChanged(address indexed treasury);

    error QuoteNotEnabled(address quoteToken);

    constructor(address positionManager_, address uniswapFactory_, address weth_, address treasury_)
        Ownable(msg.sender)
    {
        require(positionManager_ != address(0) && uniswapFactory_ != address(0), "uniswap required");
        require(weth_ != address(0), "weth required");
        require(treasury_ != address(0), "treasury required");

        positionManager = positionManager_;
        uniswapFactory = uniswapFactory_;
        weth = weth_;
        treasury = treasury_;

        // ETH pairs graduate at 12 ETH raised.
        quotes[address(0)] = QuoteConfig({enabled: true, graduationRaise: 12 ether});
        emit QuoteConfigured(address(0), true, 12 ether);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "treasury required");
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    /// @notice Enable a quote asset. USDC uses 6 decimals, so its target is
    ///         36_000e6 rather than 36_000e18.
    function configureQuote(address quoteToken, bool enabled, uint256 graduationRaise) external onlyOwner {
        require(!enabled || graduationRaise > 0, "raise required");
        quotes[quoteToken] = QuoteConfig({enabled: enabled, graduationRaise: graduationRaise});
        emit QuoteConfigured(quoteToken, enabled, graduationRaise);
    }

    function curvesLength() external view returns (uint256) {
        return allCurves.length;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string metadataURI;
        address quoteToken;
        bool mayhem;
        uint256 devBuy;       // quote spent on the opening buy
        uint256 devBuyMinOut; // slippage floor for that buy
    }

    function launch(LaunchParams calldata p) external payable returns (address token, address curve) {
        QuoteConfig memory q = quotes[p.quoteToken];
        if (!q.enabled) revert QuoteNotEnabled(p.quoteToken);

        (token, curve) = _deploy(p, q.graduationRaise);

        emit TokenLaunched(token, curve, msg.sender, p.name, p.symbol, p.quoteToken, p.mayhem, p.metadataURI);

        if (p.devBuy > 0) _openingBuy(p, curve);

        // Anything not spent on the opening buy goes straight back.
        uint256 left = address(this).balance;
        if (left > 0) {
            (bool ok, ) = payable(msg.sender).call{value: left}("");
            require(ok, "refund failed");
        }
    }

    function _deploy(LaunchParams calldata p, uint256 graduationRaise)
        private returns (address token, address curve)
    {
        token = address(new SparkToken(p.name, p.symbol, msg.sender, p.metadataURI));

        curve = address(new SparkCurve(
            SparkCurve.Config({
                quoteToken: p.quoteToken,
                creator: msg.sender,
                treasury: treasury,
                virtualBase0: p.mayhem ? MAYHEM_VIRTUAL_BASE : STANDARD_VIRTUAL_BASE,
                graduationRaise: graduationRaise,
                walletQuoteCap: p.mayhem ? 0 : (graduationRaise * WALLET_CAP_BPS) / 10_000,
                creatorFeeBps: p.mayhem ? MAYHEM_CREATOR_FEE_BPS : STANDARD_CREATOR_FEE_BPS,
                protocolFeeBps: PROTOCOL_FEE_BPS,
                mayhem: p.mayhem,
                positionManager: positionManager,
                uniswapFactory: uniswapFactory,
                weth: weth
            }),
            token
        ));

        IERC20(token).safeTransfer(curve, TOTAL_SUPPLY);

        allCurves.push(curve);
        curveOfToken[token] = curve;
    }

    function _openingBuy(LaunchParams calldata p, address curve) private {
        if (p.quoteToken == address(0)) {
            SparkCurve(payable(curve)).buy{value: p.devBuy}(0, p.devBuyMinOut, msg.sender);
        } else {
            IERC20(p.quoteToken).safeTransferFrom(msg.sender, address(this), p.devBuy);
            IERC20(p.quoteToken).forceApprove(curve, p.devBuy);
            SparkCurve(payable(curve)).buy(p.devBuy, p.devBuyMinOut, msg.sender);
        }
    }

    receive() external payable {}
}
