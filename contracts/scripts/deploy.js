/**
 * Deploys SparkFactory.
 *
 * Requires DEPLOYER_PRIVATE_KEY in the environment and a funded account on the
 * target chain. Addresses are verified against the chain before anything is
 * sent, so a wrong config fails before it costs gas.
 *
 *   DEPLOYER_PRIVATE_KEY=0x... TREASURY=0x... npm run deploy:mainnet
 */
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const ADDRESSES = require("./addresses");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY");

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const cfg = ADDRESSES[chainId];
  if (!cfg?.positionManager) throw new Error(`No Uniswap addresses configured for chain ${chainId}`);

  const treasury = process.env.TREASURY || deployer.address;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deploying to ${cfg.name} (${chainId})`);
  console.log(`  deployer ${deployer.address}  balance ${ethers.formatEther(balance)} ETH`);
  console.log(`  treasury ${treasury}`);
  if (balance === 0n) throw new Error("Deployer has no ETH");

  // Fail before spending gas if the Uniswap config is wrong.
  const pm = await ethers.getContractAt(
    ["function factory() view returns (address)", "function WETH9() view returns (address)"],
    cfg.positionManager
  );
  const onchainFactory = await pm.factory();
  const onchainWeth = await pm.WETH9();
  if (onchainFactory.toLowerCase() !== cfg.uniswapV3Factory.toLowerCase()) {
    throw new Error(`Uniswap factory mismatch: chain says ${onchainFactory}`);
  }
  if (onchainWeth.toLowerCase() !== cfg.weth.toLowerCase()) {
    throw new Error(`WETH mismatch: chain says ${onchainWeth}`);
  }

  const Factory = await ethers.getContractFactory("SparkFactory");
  const factory = await Factory.deploy(cfg.positionManager, cfg.uniswapV3Factory, cfg.weth, treasury);
  await factory.waitForDeployment();
  const address = await factory.getAddress();

  console.log(`\nSparkFactory deployed: ${address}`);
  console.log(`  ${cfg.explorer}/address/${address}`);

  if (cfg.usdc) {
    const tx = await factory.configureQuote(cfg.usdc, true, 36_000n * 10n ** 6n);
    await tx.wait();
    console.log(`  USDC pair enabled (${cfg.usdc})`);
  } else {
    console.log("  USDC pair not enabled — set usdc in scripts/addresses.js, then configureQuote");
  }

  const out = {
    chainId,
    network: network.name,
    factory: address,
    treasury,
    uniswap: {
      positionManager: cfg.positionManager,
      factory: cfg.uniswapV3Factory,
      weth: cfg.weth,
    },
    deployedAt: new Date().toISOString(),
    deployBlock: await ethers.provider.getBlockNumber(),
  };
  const file = path.join(__dirname, "..", "deployments", `${chainId}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${path.relative(process.cwd(), file)}`);
  console.log("Next: set REACT_APP_SPARK_FACTORY and SPARK_FACTORY_ADDRESS / SPARK_DEPLOY_BLOCK");
}

main().catch((e) => { console.error(e); process.exit(1); });
