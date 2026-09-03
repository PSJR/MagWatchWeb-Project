require("@nomicfoundation/hardhat-toolbox");

const { DEPLOYER_PRIVATE_KEY } = process.env;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Arbitrum Orbit does not enable Cancun opcodes; paris keeps the
      // bytecode portable across Nitro versions.
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // Graduation is tested against the real Uniswap V3 deployment on
      // Robinhood Chain rather than a mock, so the pool creation, tick range
      // and price encoding are exercised exactly as they will run in
      // production. Set FORK=0 to run the non-graduation tests offline.
      forking: process.env.FORK === "0" ? undefined : {
        url: process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      },
    },
    robinhood: {
      url: process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
    },
    robinhoodTestnet: {
      url: process.env.TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts,
    },
  },
};
