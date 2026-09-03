/**
 * Generates tests/fixtures/curve_cases.json straight from the compiled
 * contract. The Python and JS mirrors are asserted against these, so the
 * contract — not a spreadsheet — defines what "correct" means.
 *
 *   cd contracts && npx hardhat run scripts/dump-curve-fixtures.js
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const ONE = 10n ** 18n;
const UNISWAP = {
  positionManager: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  weth: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
};

// [mayhem, quoteRaisedTargetWei, side, amountWei]
const CASES = [
  [false, 0n, "buy", ONE / 1000n],
  [false, 0n, "buy", ONE / 20n],
  [false, ONE, "buy", ONE / 2n],
  [false, 4n * ONE, "buy", ONE],
  [false, 8n * ONE, "buy", 3n * ONE],
  [false, 11n * ONE, "buy", 100n * ONE],  // overshoot: refund + graduate
  [true, 0n, "buy", ONE / 20n],
  [true, 3n * ONE, "buy", 2n * ONE],
  [false, 2n * ONE, "sell", 1_000_000n * ONE],
  [false, 6n * ONE, "sell", 50_000_000n * ONE],
  [true, 5n * ONE, "sell", 10_000_000n * ONE],
];

async function main() {
  const [deployer, creator, whale, treasury] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("SparkFactory");
  const factory = await Factory.deploy(UNISWAP.positionManager, UNISWAP.factory, UNISWAP.weth, treasury.address);
  await factory.waitForDeployment();

  const out = [];
  for (const [mayhem, warmup, side, amount] of CASES) {
    // Mayhem is uncapped, so a single wallet can position the curve anywhere.
    const tx = await factory.connect(creator).launch({
      name: "Fixture", symbol: "FIX", metadataURI: "",
      quoteToken: ethers.ZeroAddress, mayhem: true, devBuy: 0, devBuyMinOut: 0,
    });
    await tx.wait();
    const curveAddr = await factory.allCurves((await factory.curvesLength()) - 1n);
    let curve = await ethers.getContractAt("SparkCurve", curveAddr);

    // For non-mayhem cases relaunch with the standard curve.
    if (!mayhem) {
      const t2 = await factory.connect(creator).launch({
        name: "Fixture", symbol: "FIX", metadataURI: "",
        quoteToken: ethers.ZeroAddress, mayhem: false, devBuy: 0, devBuyMinOut: 0,
      });
      await t2.wait();
      curve = await ethers.getContractAt("SparkCurve", await factory.allCurves((await factory.curvesLength()) - 1n));
    }

    // Walk the curve to the warm-up point using as many wallets as the cap needs.
    const signers = await ethers.getSigners();
    let i = 3;
    while ((await curve.quoteRaised()) < warmup) {
      const cap = await curve.walletQuoteCap();
      const left = warmup - (await curve.quoteRaised());
      const step = cap === 0n ? left : (left < cap ? left : cap);
      const who = cap === 0n ? whale : signers[i++ % signers.length];
      await curve.connect(who).buy(0, 0, ethers.ZeroAddress, { value: step + step / 100n });
      if (i > 60) break;
    }

    const baseSold = await curve.baseSold();
    const quoteRaised = await curve.quoteRaised();
    let expected;
    if (side === "buy") {
      const [baseOut, creatorFee, protocolFee, refund] = await curve.previewBuy(amount);
      expected = { base_out: baseOut, creator_fee: creatorFee, protocol_fee: protocolFee, refund };
    } else {
      const [quoteOut, creatorFee, protocolFee] = await curve.previewSell(amount);
      expected = { quote_out: quoteOut, creator_fee: creatorFee, protocol_fee: protocolFee };
    }

    out.push({
      mayhem, side,
      base_sold: baseSold.toString(),
      quote_raised: quoteRaised.toString(),
      amount: amount.toString(),
      expected: Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, v.toString()])),
    });
  }

  const file = path.join(__dirname, "..", "..", "tests", "fixtures", "curve_cases.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    generated_from: "contracts/SparkCurve.sol",
    note: "Regenerate with: cd contracts && npx hardhat run scripts/dump-curve-fixtures.js",
    cases: out,
  }, null, 2) + "\n");
  console.log(`wrote ${out.length} cases to tests/fixtures/curve_cases.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
