/**
 * spark.fun bonding curve — client mirror of contracts/SparkCurve.sol.
 *
 * The contract is exact integer arithmetic, so this is BigInt too: a float
 * preview would disagree with settlement in the last digits, and the trade
 * panel would promise a number the chain does not deliver. Every function here
 * mirrors the Solidity line for line, including rounding direction.
 *
 *   baseOut  = virtualBase  * quoteIn / (virtualQuote + quoteIn)
 *   quoteOut = virtualQuote * baseIn  / (virtualBase  + baseIn)
 *
 * tests/test_curve_parity.py pins this file, curve.py and the contract together.
 */

const E18 = 10n ** 18n;

export const TOTAL_SUPPLY = 1_000_000_000n * E18;
export const CURVE_SUPPLY = 800_000_000n * E18;
export const LP_SUPPLY = 200_000_000n * E18;
export const BPS = 10_000n;

export const STANDARD_VIRTUAL_BASE = 1_073_000_000n * E18;
/** Mayhem steepens the curve. Floor is CURVE_SUPPLY or the curve has no solution. */
export const MAYHEM_VIRTUAL_BASE = (1_073_000_000n * E18 * 85n) / 100n;

export const STANDARD_CREATOR_FEE_BPS = 100n;
export const MAYHEM_CREATOR_FEE_BPS = 250n;
export const PROTOCOL_FEE_BPS = 50n;
export const WALLET_CAP_BPS = 1_000n; // 10% of the graduation target

export const PAIRS = {
  ETH: {
    symbol: 'ETH',
    label: 'ETH',
    decimals: 18,
    graduationRaise: 12n * E18,
    address: null, // native
    blurb: "the chain's native gas",
  },
  USDC: {
    symbol: 'USDC',
    label: 'USDC',
    decimals: 6,
    graduationRaise: 36_000n * 10n ** 6n,
    address: null, // set from REACT_APP_USDC_ADDRESS at runtime
    blurb: 'stable price, market cap you can read',
  },
};

const ceilDiv = (a, b) => (a + b - 1n) / b;
const big = (v) => (typeof v === 'bigint' ? v : BigInt(v ?? 0));

export function curveParams({ pair = 'ETH', mayhem = false } = {}) {
  const p = PAIRS[pair] || PAIRS.ETH;
  const virtualBase0 = mayhem ? MAYHEM_VIRTUAL_BASE : STANDARD_VIRTUAL_BASE;
  const graduationRaise = p.graduationRaise;
  return {
    pair: p.symbol,
    decimals: p.decimals,
    mayhem,
    virtualBase0,
    // Derived exactly as the constructor does, so both land on the target.
    virtualQuote0: (graduationRaise * (virtualBase0 - CURVE_SUPPLY)) / CURVE_SUPPLY,
    graduationRaise,
    creatorFeeBps: mayhem ? MAYHEM_CREATOR_FEE_BPS : STANDARD_CREATOR_FEE_BPS,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    walletQuoteCap: mayhem ? 0n : (graduationRaise * WALLET_CAP_BPS) / BPS,
  };
}

export const virtualBase = (p, baseSold) => p.virtualBase0 - big(baseSold);
export const virtualQuote = (p, quoteRaised) => p.virtualQuote0 + big(quoteRaised);

/** Spot price in quote per whole token, as a Number for display only. */
export function spotPrice(p, baseSold, quoteRaised) {
  const vb = virtualBase(p, baseSold);
  const vq = virtualQuote(p, quoteRaised);
  if (vb <= 0n) return 0;
  return Number(vq) / Number(vb);
}

export function marketCap(p, baseSold, quoteRaised) {
  return spotPrice(p, baseSold, quoteRaised) * Number(TOTAL_SUPPLY / E18);
}

export function progress(p, quoteRaised) {
  const raised = big(quoteRaised);
  if (raised >= p.graduationRaise) return 1;
  return Number((raised * 10_000n) / p.graduationRaise) / 10_000;
}

export function quoteToGraduate(p, quoteRaised) {
  const raised = big(quoteRaised);
  return raised >= p.graduationRaise ? 0n : p.graduationRaise - raised;
}

/** Mirrors SparkCurve.previewBuy, including the ceil on an oversized final buy. */
export function quoteBuy(p, baseSold, quoteRaised, quoteIn) {
  let amount = big(quoteIn);
  const sold = big(baseSold);
  if (amount <= 0n) return emptyQuote('buy');

  const vb = virtualBase(p, sold);
  const vq = virtualQuote(p, quoteRaised);
  const net = amount - (amount * p.creatorFeeBps) / BPS - (amount * p.protocolFeeBps) / BPS;

  let baseOut = (vb * net) / (vq + net);
  let refund = 0n;

  const remaining = CURVE_SUPPLY - sold;
  if (baseOut > remaining) {
    baseOut = remaining;
    const netNeeded = ceilDiv(baseOut * vq, vb - baseOut);
    let gross = ceilDiv(netNeeded * BPS, BPS - p.creatorFeeBps - p.protocolFeeBps);
    if (gross >= amount) gross = amount;
    refund = amount - gross;
    amount = gross;
  }

  const creatorFee = (amount * p.creatorFeeBps) / BPS;
  const protocolFee = (amount * p.protocolFeeBps) / BPS;
  const netSpent = amount - creatorFee - protocolFee;
  const nextRaised = big(quoteRaised) + netSpent;

  return {
    side: 'buy',
    baseOut,
    quoteIn: amount,
    refund,
    creatorFee,
    protocolFee,
    nextSold: sold + baseOut,
    nextRaised,
    graduates: nextRaised >= p.graduationRaise || sold + baseOut >= CURVE_SUPPLY,
    priceBefore: spotPrice(p, sold, quoteRaised),
    priceAfter: spotPrice(p, sold + baseOut, nextRaised),
  };
}

/** Mirrors SparkCurve.previewSell. */
export function quoteSell(p, baseSold, quoteRaised, baseIn) {
  const sold = big(baseSold);
  let amount = big(baseIn);
  if (amount <= 0n) return emptyQuote('sell');
  if (amount > sold) amount = sold;

  const gross = (virtualQuote(p, quoteRaised) * amount) / (virtualBase(p, sold) + amount);
  const creatorFee = (gross * p.creatorFeeBps) / BPS;
  const protocolFee = (gross * p.protocolFeeBps) / BPS;
  const nextRaised = big(quoteRaised) - gross;

  return {
    side: 'sell',
    baseIn: amount,
    quoteOut: gross - creatorFee - protocolFee,
    grossQuote: gross,
    creatorFee,
    protocolFee,
    nextSold: sold - amount,
    nextRaised,
    graduates: false,
    priceBefore: spotPrice(p, sold, quoteRaised),
    priceAfter: spotPrice(p, sold - amount, nextRaised),
  };
}

/** Price impact as a Number, for the panel's warning line. */
export function priceImpact(q) {
  if (!q.priceBefore) return 0;
  return (q.priceAfter - q.priceBefore) / q.priceBefore;
}

/** Samples the whole curve for the chart. Floats are fine here — it is a shape. */
export function curveSamples(p, quoteRaised, points = 72) {
  const out = [];
  const target = Number(p.graduationRaise);
  for (let i = 0; i <= points; i++) {
    const raised = BigInt(Math.floor((Number(p.graduationRaise) * i) / points));
    // Invert the invariant: baseSold such that vq0 + raised holds.
    const vq = p.virtualQuote0 + raised;
    const vb = (p.virtualBase0 * p.virtualQuote0) / vq;
    const sold = p.virtualBase0 - vb;
    out.push({
      progress: (i / points) * 100,
      cap: (Number(vq) / Number(vb)) * Number(TOTAL_SUPPLY / E18),
      price: Number(vq) / Number(vb),
      reached: Number(raised) <= Number(quoteRaised ?? 0n),
      raisedShare: target ? Number(raised) / target : 0,
      sold,
    });
  }
  return out;
}

function emptyQuote(side) {
  return {
    side,
    baseOut: 0n, baseIn: 0n, quoteIn: 0n, quoteOut: 0n, grossQuote: 0n,
    refund: 0n, creatorFee: 0n, protocolFee: 0n,
    nextSold: 0n, nextRaised: 0n, graduates: false,
    priceBefore: 0, priceAfter: 0,
  };
}
