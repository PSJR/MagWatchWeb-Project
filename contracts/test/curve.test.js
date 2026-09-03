const { expect } = require("chai");
const { ethers } = require("hardhat");

// Verified on-chain: positionManager.factory() returns the factory below, and
// positionManager.WETH9() returns this WETH. See scripts/addresses.js.
const UNISWAP = {
  positionManager: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  weth: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
};

const ONE = 10n ** 18n;
const CURVE_SUPPLY = 800_000_000n * ONE;
const LP_SUPPLY = 200_000_000n * ONE;
const VB0 = 1_073_000_000n * ONE;
const GRADUATION = 12n * ONE;
const VQ0 = (GRADUATION * (VB0 - CURVE_SUPPLY)) / CURVE_SUPPLY;

/** Reference implementation, mirroring SparkCurve exactly in integers. */
function previewBuy(baseSold, quoteRaised, quoteIn, creatorBps = 100n, protocolBps = 50n, vb0 = VB0) {
  const vq0 = (GRADUATION * (vb0 - CURVE_SUPPLY)) / CURVE_SUPPLY;
  const vb = vb0 - baseSold;
  const vq = vq0 + quoteRaised;
  const net = quoteIn - (quoteIn * creatorBps) / 10000n - (quoteIn * protocolBps) / 10000n;
  let baseOut = (vb * net) / (vq + net);
  let refund = 0n;
  const remaining = CURVE_SUPPLY - baseSold;
  if (baseOut > remaining) {
    baseOut = remaining;
    const netNeeded = ceilDiv(baseOut * vq, vb - baseOut);
    let gross = ceilDiv(netNeeded * 10000n, 10000n - creatorBps - protocolBps);
    if (gross >= quoteIn) gross = quoteIn;
    refund = quoteIn - gross;
    quoteIn = gross;
  }
  return {
    baseOut,
    refund,
    creatorFee: (quoteIn * creatorBps) / 10000n,
    protocolFee: (quoteIn * protocolBps) / 10000n,
  };
}
const ceilDiv = (a, b) => (a + b - 1n) / b;

async function deployFactory() {
  const [deployer, creator, alice, bob, treasury] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("SparkFactory");
  const factory = await Factory.deploy(
    UNISWAP.positionManager, UNISWAP.factory, UNISWAP.weth, treasury.address
  );
  await factory.waitForDeployment();
  return { factory, deployer, creator, alice, bob, treasury };
}

async function launch(factory, creator, { mayhem = false, devBuy = 0n } = {}) {
  const tx = await factory.connect(creator).launch(
    {
      name: "Pizza da Meia-Noite",
      symbol: "PIZZA",
      metadataURI: "ipfs://meta",
      quoteToken: ethers.ZeroAddress,
      mayhem,
      devBuy,
      devBuyMinOut: 0,
    },
    { value: devBuy }
  );
  const receipt = await tx.wait();
  const ev = receipt.logs
    .map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } })
    .find((l) => l && l.name === "TokenLaunched");
  return {
    token: await ethers.getContractAt("SparkToken", ev.args.token),
    curve: await ethers.getContractAt("SparkCurve", ev.args.curve),
  };
}

describe("SparkFactory / SparkCurve", () => {
  describe("launch", () => {
    it("mints the entire supply into the curve and nowhere else", async () => {
      const { factory, creator } = await deployFactory();
      const { token, curve } = await launch(factory, creator);

      expect(await token.totalSupply()).to.equal(1_000_000_000n * ONE);
      expect(await token.balanceOf(await curve.getAddress())).to.equal(1_000_000_000n * ONE);
      expect(await token.balanceOf(await factory.getAddress())).to.equal(0n);
      expect(await token.balanceOf(creator.address)).to.equal(0n);
    });

    it("has no way to mint more", async () => {
      const { factory, creator } = await deployFactory();
      const { token } = await launch(factory, creator);
      expect(token.interface.fragments.some((f) => f.name === "mint")).to.equal(false);
    });

    it("derives virtualQuote0 so the curve lands exactly on the target", async () => {
      const { factory, creator } = await deployFactory();
      const { curve } = await launch(factory, creator);
      expect(await curve.virtualQuote0()).to.equal(VQ0);
      expect(await curve.graduationRaise()).to.equal(GRADUATION);
    });

    it("performs the opening buy in the same transaction", async () => {
      const { factory, creator } = await deployFactory();
      const { token, curve } = await launch(factory, creator, { devBuy: ethers.parseEther("0.5") });
      const balance = await token.balanceOf(creator.address);
      expect(balance).to.be.greaterThan(0n);
      expect(await curve.baseSold()).to.equal(balance);
    });
  });

  describe("buying", () => {
    it("matches the reference curve exactly along the standard curve", async () => {
      const { factory, creator, alice, bob } = await deployFactory();
      const { curve } = await launch(factory, creator);

      // Each buyer stays under the per-wallet cap, so the sweep walks the curve
      // without the cap interfering.
      for (const [who, eth] of [[alice, "0.001"], [alice, "0.05"], [bob, "1"], [alice, "1.1"]]) {
        const amount = ethers.parseEther(eth);
        const sold = await curve.baseSold();
        const raised = await curve.quoteRaised();
        const expected = previewBuy(sold, raised, amount);

        const preview = await curve.previewBuy(amount);
        expect(preview[0]).to.equal(expected.baseOut);
        expect(preview[1]).to.equal(expected.creatorFee);
        expect(preview[2]).to.equal(expected.protocolFee);

        await curve.connect(who).buy(0, 0, ethers.ZeroAddress, { value: amount });
        expect(await curve.baseSold()).to.equal(sold + expected.baseOut);
      }
    });

    it("matches the reference curve exactly along the Mayhem curve", async () => {
      const { factory, creator, alice } = await deployFactory();
      const { curve } = await launch(factory, creator, { mayhem: true });
      const MAYHEM_VB = (1_073_000_000n * ONE * 85n) / 100n;

      for (const eth of ["0.001", "0.05", "1", "3.5"]) {
        const amount = ethers.parseEther(eth);
        const sold = await curve.baseSold();
        const raised = await curve.quoteRaised();
        const expected = previewBuy(sold, raised, amount, 250n, 50n, MAYHEM_VB);

        const preview = await curve.previewBuy(amount);
        expect(preview[0]).to.equal(expected.baseOut);
        expect(preview[1]).to.equal(expected.creatorFee);

        await curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: amount });
        expect(await curve.baseSold()).to.equal(sold + expected.baseOut);
      }
    });

    it("respects the slippage floor", async () => {
      const { factory, creator, alice } = await deployFactory();
      const { curve } = await launch(factory, creator);
      const amount = ethers.parseEther("0.1");
      const [expected] = await curve.previewBuy(amount);

      await expect(
        curve.connect(alice).buy(0, expected + 1n, ethers.ZeroAddress, { value: amount })
      ).to.be.revertedWithCustomError(curve, "SlippageExceeded");
    });

    it("enforces the wallet cap on standard tokens and drops it on Mayhem", async () => {
      const { factory, creator, alice } = await deployFactory();

      const std = await launch(factory, creator);
      // 10% of the 12 ETH target: a token needs at least ten wallets to graduate.
      expect(await std.curve.walletQuoteCap()).to.equal((GRADUATION * 10n) / 100n);
      await expect(
        std.curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: ethers.parseEther("1") })
      ).not.to.be.reverted;
      await expect(
        std.curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: ethers.parseEther("5") })
      ).to.be.revertedWithCustomError(std.curve, "WalletCapExceeded");

      const mayhem = await launch(factory, creator, { mayhem: true });
      expect(await mayhem.curve.walletQuoteCap()).to.equal(0n);
      await expect(
        mayhem.curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: ethers.parseEther("5") })
      ).not.to.be.reverted;
    });

    it("charges the Mayhem creator fee", async () => {
      const { factory, creator } = await deployFactory();
      const std = await launch(factory, creator);
      const mh = await launch(factory, creator, { mayhem: true });
      expect(await std.curve.creatorFeeBps()).to.equal(100n);
      expect(await mh.curve.creatorFeeBps()).to.equal(250n);
      expect(await mh.curve.virtualBase0()).to.be.lessThan(await std.curve.virtualBase0());
      expect(await mh.curve.virtualBase0()).to.be.greaterThan(CURVE_SUPPLY);
    });
  });

  describe("selling", () => {
    it("round-trips for less than it cost, and the difference is the fees", async () => {
      const { factory, creator, alice } = await deployFactory();
      const { token, curve } = await launch(factory, creator);
      const spend = ethers.parseEther("1");

      await curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: spend });
      const got = await token.balanceOf(alice.address);

      await token.connect(alice).approve(await curve.getAddress(), got);
      const before = await ethers.provider.getBalance(alice.address);
      const tx = await curve.connect(alice).sell(got, 0, ethers.ZeroAddress);
      const rcpt = await tx.wait();
      const after = await ethers.provider.getBalance(alice.address);

      const received = after - before + rcpt.gasUsed * rcpt.gasPrice;
      expect(received).to.be.lessThan(spend);
      expect(received).to.be.greaterThan((spend * 96n) / 100n); // ~1.5% each way
      expect(await curve.baseSold()).to.equal(0n);
    });

    it("cannot sell tokens it never sold", async () => {
      const { factory, creator, alice } = await deployFactory();
      const { curve } = await launch(factory, creator);
      await expect(
        curve.connect(alice).sell(1n * ONE, 0, ethers.ZeroAddress)
      ).to.be.reverted;
    });
  });

  describe("fees", () => {
    it("accrues to the creator and the treasury, and only they can claim", async () => {
      const { factory, creator, alice, treasury } = await deployFactory();
      const { curve } = await launch(factory, creator);
      await curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: ethers.parseEther("1") });

      const creatorFees = await curve.claimableCreatorFees();
      expect(creatorFees).to.equal(ethers.parseEther("0.01")); // 1%
      expect(await curve.protocolFeesAccrued()).to.equal(ethers.parseEther("0.005")); // 0.5%

      const before = await ethers.provider.getBalance(creator.address);
      await curve.connect(alice).claimCreatorFees(); // anyone may trigger; funds go to the creator
      expect(await ethers.provider.getBalance(creator.address)).to.equal(before + creatorFees);
      expect(await curve.claimableCreatorFees()).to.equal(0n);

      const tBefore = await ethers.provider.getBalance(treasury.address);
      await curve.connect(alice).claimProtocolFees();
      expect(await ethers.provider.getBalance(treasury.address)).to.be.greaterThan(tBefore);
    });
  });
});

describe("graduation (forked Robinhood Chain, real Uniswap V3)", () => {
  const FEE = 10_000;

  async function graduate() {
    const { factory, creator, alice } = await deployFactory();
    // Mayhem is uncapped, so one funded wallet can carry the curve to the
    // target; the standard curve is graduated with many wallets below.
    const { token, curve } = await launch(factory, creator, { mayhem: true });

    let guard = 0;
    while (!(await curve.graduated())) {
      const left = await curve.quoteToGraduate();
      const step = left > ethers.parseEther("3") ? ethers.parseEther("3") : left + ethers.parseEther("0.2");
      await curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: step });
      if (++guard > 40) throw new Error("curve never graduated");
    }
    return { factory, curve, token, creator, alice };
  }

  it("creates a real Uniswap V3 pool and seeds it", async () => {
    const { curve, token } = await graduate();

    expect(await curve.graduated()).to.equal(true);
    const pool = await curve.pool();
    expect(pool).to.not.equal(ethers.ZeroAddress);

    const uni = await ethers.getContractAt("IUniswapV3Factory", UNISWAP.factory);
    expect(await uni.getPool(await token.getAddress(), UNISWAP.weth, FEE)).to.equal(pool);

    const poolC = await ethers.getContractAt("IUniswapV3Pool", pool);
    const slot0 = await poolC.slot0();
    expect(slot0[0]).to.be.greaterThan(0n); // initialized price

    // The pool actually holds the liquidity.
    expect(await token.balanceOf(pool)).to.be.greaterThan(0n);
    const weth = await ethers.getContractAt("IERC20", UNISWAP.weth);
    expect(await weth.balanceOf(pool)).to.be.greaterThan(0n);
  });

  it("keeps the position and leaves no token dust behind", async () => {
    const { curve, token } = await graduate();
    expect(await curve.positionTokenId()).to.be.greaterThan(0n);

    const pm = await ethers.getContractAt(
      ["function ownerOf(uint256) view returns (address)"], UNISWAP.positionManager
    );
    expect(await pm.ownerOf(await curve.positionTokenId())).to.equal(await curve.getAddress());

    // Everything the curve held is either sold, in the pool, or burned.
    expect(await token.balanceOf(await curve.getAddress())).to.equal(0n);
    expect(await ethers.provider.getBalance(await curve.getAddress())).to.equal(
      await curve.claimableCreatorFees() + await curve.protocolFeesAccrued()
    );
  });

  it("closes the curve permanently", async () => {
    const { curve, alice } = await graduate();
    await expect(
      curve.connect(alice).buy(0, 0, ethers.ZeroAddress, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWithCustomError(curve, "AlreadyGraduated");
    await expect(
      curve.connect(alice).sell(1n * ONE, 0, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(curve, "AlreadyGraduated");
  });

  it("has no code path that can withdraw the liquidity", async () => {
    const { curve } = await graduate();
    const names = curve.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const forbidden of ["decreaseLiquidity", "burn", "withdraw", "unlock", "removeLiquidity", "rescue"]) {
      expect(names).to.not.include(forbidden);
    }
    // collect is the only interaction with the position, and it moves fees only.
    expect(names).to.include("collectPoolFees");
    await expect(curve.collectPoolFees()).not.to.be.reverted;
  });

  it("graduates the standard curve across many wallets", async () => {
    const { factory, creator } = await deployFactory();
    const { curve } = await launch(factory, creator);
    const signers = (await ethers.getSigners()).slice(5);

    for (const s of signers) {
      if (await curve.graduated()) break;
      const left = await curve.quoteToGraduate();
      const cap = await curve.walletQuoteCap();
      const step = left < cap ? left + ethers.parseEther("0.05") : cap;
      await curve.connect(s).buy(0, 0, ethers.ZeroAddress, { value: step });
    }

    expect(await curve.graduated()).to.equal(true);
    expect(await curve.pool()).to.not.equal(ethers.ZeroAddress);
  });
});
