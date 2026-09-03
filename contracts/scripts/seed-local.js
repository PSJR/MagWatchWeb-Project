/** Deploys to the local node and produces real activity for the indexer test. */
const fs = require("fs");
const { ethers } = require("hardhat");

const UNI = {
  positionManager: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  weth: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
};

async function main() {
  const [deployer, creator, alice] = await ethers.getSigners();
  const F = await ethers.getContractFactory("SparkFactory");
  const factory = await F.deploy(UNI.positionManager, UNI.factory, UNI.weth, deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const deployBlock = await ethers.provider.getBlockNumber();

  const tx = await factory.connect(creator).launch({
    name: "Pizza da Meia-Noite", symbol: "PIZZA", metadataURI: "sparkfun:abc",
    quoteToken: ethers.ZeroAddress, mayhem: false,
    devBuy: ethers.parseEther("0.2"), devBuyMinOut: 0,
  }, { value: ethers.parseEther("0.2") });
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } })
    .find((l) => l && l.name === "TokenLaunched");

  const curve = await ethers.getContractAt("SparkCurve", ev.args.curve);
  await curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: ethers.parseEther("0.7") });

  const token = await ethers.getContractAt("SparkToken", ev.args.token);
  const bal = await token.balanceOf(alice.address);
  await token.connect(alice).approve(ev.args.curve, bal);
  await curve.connect(alice).sell(bal / 2n, 0, ethers.ZeroAddress);

  const out = {
    rpc: "http://127.0.0.1:8545",
    chainId: 31337,
    factory: factoryAddress,
    deployBlock,
    token: ev.args.token,
    curve: ev.args.curve,
    creator: creator.address,
    alice: alice.address,
    head: await ethers.provider.getBlockNumber(),
    baseSold: (await curve.baseSold()).toString(),
    quoteRaised: (await curve.quoteRaised()).toString(),
  };
  fs.writeFileSync("/tmp/claude-0/-home-user-MagWatchWeb-Project/5f2e6c79-3386-5075-a51a-7f1ac1340fdd/scratchpad/local.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
