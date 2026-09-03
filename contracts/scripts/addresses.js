/**
 * Robinhood Chain addresses.
 *
 * Every value below was read from the chain, not from documentation:
 *   positionManager.factory() === uniswapV3Factory
 *   positionManager.WETH9()   === weth
 * Re-verify with `npx hardhat run scripts/verify-addresses.js --network robinhood`.
 */
module.exports = {
  4663: {
    name: "Robinhood Chain",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    positionManager: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
    uniswapV3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
    weth: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
    // Set once a canonical USDC is confirmed on this chain, then call
    // factory.configureQuote(usdc, true, 36_000e6).
    usdc: null,
  },
  46630: {
    name: "Robinhood Chain Testnet",
    rpc: "https://rpc.testnet.chain.robinhood.com",
    explorer: "https://testnet.robinhoodchain.blockscout.com",
    // Testnet Uniswap addresses must be confirmed before deploying there.
    positionManager: null,
    uniswapV3Factory: null,
    weth: null,
    usdc: null,
  },
};
