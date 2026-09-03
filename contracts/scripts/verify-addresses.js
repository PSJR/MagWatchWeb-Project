/** Confirms the configured Uniswap addresses agree with the chain itself. */
const { ethers, network } = require("hardhat");
const ADDRESSES = require("./addresses");

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const cfg = ADDRESSES[chainId];
  if (!cfg) throw new Error(`No addresses configured for chain ${chainId}`);
  if (!cfg.positionManager) throw new Error(`positionManager not set for ${cfg.name}`);

  const pm = await ethers.getContractAt(
    ["function factory() view returns (address)", "function WETH9() view returns (address)"],
    cfg.positionManager
  );

  const factory = await pm.factory();
  const weth = await pm.WETH9();
  const ok = (a, b) => a.toLowerCase() === b.toLowerCase();

  console.log(`${cfg.name} (${chainId}) via ${network.name}`);
  console.log(`  positionManager.factory() = ${factory} ${ok(factory, cfg.uniswapV3Factory) ? "OK" : "MISMATCH"}`);
  console.log(`  positionManager.WETH9()   = ${weth} ${ok(weth, cfg.weth) ? "OK" : "MISMATCH"}`);

  if (!ok(factory, cfg.uniswapV3Factory) || !ok(weth, cfg.weth)) {
    throw new Error("configured addresses disagree with the chain — do not deploy");
  }
  console.log("  all addresses confirmed on-chain");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
