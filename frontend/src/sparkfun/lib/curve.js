/**
 * spark.fun bonding curve — "a fogueira"
 *
 * Constant-product curve over *virtual* reserves, the same shape used by the
 * dominant launchpads, parameterised for the Robinhood Chain (ETH gas).
 *
 *   k = virtualBase * virtualQuote                       (invariant)
 *   baseOut  = virtualBase  - k / (virtualQuote + dQuote)  (buy)
 *   quoteOut = virtualQuote - k / (virtualBase  + dBase)   (sell)
 *   price    = virtualQuote / virtualBase
 *
 * The curve sells CURVE_SUPPLY tokens. When the raise reaches the pair's
 * graduation target, the curve closes and LP_SUPPLY plus the raised quote seed
 * a permanently locked Uniswap V3 position — "a chama eterna".
 *
 * IMPORTANT: this file is mirrored byte-for-byte in behaviour by
 * backend/sparkfun/curve.py, which is the settlement source of truth. The
 * client copy exists only for instant (sub-frame) quote previews. Any change
 * here must be made there, and backend/tests/test_curve_parity.py must pass.
 */

export const TOTAL_SUPPLY = 1_000_000_000;
export const CURVE_SUPPLY = 800_000_000; // sold along the curve
export const LP_SUPPLY = 200_000_000;    // seeded into Uniswap V3 at graduation

export const FEES = {
  standard: { creator: 0.010, protocol: 0.005 },
  // Mayhem pays the creator more and charges the same protocol cut.
  mayhem: { creator: 0.025, protocol: 0.005 },
};

/** Per-wallet cap as a share of CURVE_SUPPLY. Mayhem removes it entirely. */
export const WALLET_CAP_SHARE = 0.02;

export const PAIRS = {
  ETH: {
    symbol: 'ETH',
    label: 'ETH',
    decimals: 18,
    graduationRaise: 12,     // ETH raised on the curve before graduation
    virtualBase0: 1_073_000_000,
    blurb: 'o gas nativo da chain',
  },
  USDC: {
    symbol: 'USDC',
    label: 'USDC',
    decimals: 6,
    graduationRaise: 36_000, // USDC
    virtualBase0: 1_073_000_000,
    blurb: 'preço estável, market cap fácil de ler',
  },
};

/**
 * Mayhem steepens the curve: less virtual base means faster price impact.
 * The factor has a hard floor — virtualBase0 must stay above CURVE_SUPPLY or
 * the curve has no solution (1.073e9 * f > 8e8 => f > 0.7456). 0.85 keeps a
 * safe margin while roughly halving the starting cap and doubling the final one.
 */
const MAYHEM_STEEPNESS = 0.85;

/**
 * Resolve the immutable curve parameters for a token.
 * virtualQuote0 is derived so the curve reaches exactly `graduationRaise`
 * at the moment CURVE_SUPPLY has been sold.
 */
export function curveParams({ pair = 'ETH', mayhem = false } = {}) {
  const p = PAIRS[pair] || PAIRS.ETH;
  const virtualBase0 = p.virtualBase0 * (mayhem ? MAYHEM_STEEPNESS : 1);
  const remaining = virtualBase0 - CURVE_SUPPLY;
  if (remaining <= 0) throw new Error('curve misconfigured: virtualBase0 must exceed CURVE_SUPPLY');
  const virtualQuote0 = (p.graduationRaise * remaining) / CURVE_SUPPLY;
  return {
    pair: p.symbol,
    mayhem,
    virtualBase0,
    virtualQuote0,
    graduationRaise: p.graduationRaise,
    fees: mayhem ? FEES.mayhem : FEES.standard,
    walletCap: mayhem ? null : CURVE_SUPPLY * WALLET_CAP_SHARE,
  };
}

/** Live reserves given how much of the curve supply has been sold. */
export function reserves(params, baseSold) {
  const virtualBase = params.virtualBase0 - baseSold;
  const k = params.virtualBase0 * params.virtualQuote0;
  const virtualQuote = k / virtualBase;
  return { virtualBase, virtualQuote, k, raised: virtualQuote - params.virtualQuote0 };
}

/** Spot price in quote per token. */
export function spotPrice(params, baseSold) {
  const { virtualBase, virtualQuote } = reserves(params, baseSold);
  return virtualQuote / virtualBase;
}

/** Fully diluted market cap, in quote units. */
export function marketCap(params, baseSold) {
  return spotPrice(params, baseSold) * TOTAL_SUPPLY;
}

/** Curve completion, 0..1 — what the progress bar and the flame read from. */
export function progress(params, baseSold) {
  return clamp(baseSold / CURVE_SUPPLY, 0, 1);
}

/** Quote still needed to graduate. */
export function quoteToGraduate(params, baseSold) {
  const { raised } = reserves(params, baseSold);
  return Math.max(0, params.graduationRaise - raised);
}

/**
 * Quote a buy. `quoteIn` is the gross amount the user spends; fees come off
 * the top so the number they type is the number that leaves their wallet.
 */
export function quoteBuy(params, baseSold, quoteIn) {
  if (!(quoteIn > 0)) return emptyQuote(params, baseSold, 'buy');
  const { creator, protocol } = params.fees;
  const creatorFee = quoteIn * creator;
  const protocolFee = quoteIn * protocol;
  const net = quoteIn - creatorFee - protocolFee;

  const { virtualBase, virtualQuote, k } = reserves(params, baseSold);
  let baseOut = virtualBase - k / (virtualQuote + net);

  // The curve never sells more than it has left; the remainder is refunded.
  const available = CURVE_SUPPLY - baseSold;
  let refund = 0;
  if (baseOut > available) {
    baseOut = available;
    const quoteNeeded = k / (virtualBase - baseOut) - virtualQuote;
    const grossNeeded = quoteNeeded / (1 - creator - protocol);
    refund = Math.max(0, quoteIn - grossNeeded);
  }

  const spendGross = quoteIn - refund;
  const nextSold = baseSold + baseOut;
  return {
    side: 'buy',
    baseOut,
    quoteIn: spendGross,
    refund,
    creatorFee: spendGross * creator,
    protocolFee: spendGross * protocol,
    avgPrice: baseOut > 0 ? spendGross / baseOut : 0,
    priceBefore: spotPrice(params, baseSold),
    priceAfter: spotPrice(params, nextSold),
    priceImpact: impact(spotPrice(params, baseSold), spotPrice(params, nextSold)),
    nextSold,
    graduates: nextSold >= CURVE_SUPPLY - 1e-9,
  };
}

/** Quote a sell. `baseIn` is tokens sold; fees come off the proceeds. */
export function quoteSell(params, baseSold, baseIn) {
  if (!(baseIn > 0)) return emptyQuote(params, baseSold, 'sell');
  const amount = Math.min(baseIn, baseSold);
  const { virtualBase, virtualQuote, k } = reserves(params, baseSold);
  const gross = virtualQuote - k / (virtualBase + amount);

  const { creator, protocol } = params.fees;
  const creatorFee = gross * creator;
  const protocolFee = gross * protocol;
  const nextSold = baseSold - amount;

  return {
    side: 'sell',
    baseIn: amount,
    quoteOut: gross - creatorFee - protocolFee,
    grossQuote: gross,
    creatorFee,
    protocolFee,
    avgPrice: amount > 0 ? gross / amount : 0,
    priceBefore: spotPrice(params, baseSold),
    priceAfter: spotPrice(params, nextSold),
    priceImpact: impact(spotPrice(params, baseSold), spotPrice(params, nextSold)),
    nextSold,
    graduates: false,
  };
}

/** Tokens receivable for a target quote spend, used by the MAX/percent chips. */
export function baseForQuote(params, baseSold, quoteIn) {
  return quoteBuy(params, baseSold, quoteIn).baseOut;
}

/**
 * Sample the curve for the chart: `points` price samples across the whole
 * curve, plus the live position. Cheap enough to recompute per render.
 */
export function curveSamples(params, baseSold, points = 64) {
  const out = [];
  for (let i = 0; i <= points; i++) {
    const sold = (CURVE_SUPPLY * i) / points;
    out.push({
      sold,
      progress: sold / CURVE_SUPPLY,
      price: spotPrice(params, sold),
      cap: marketCap(params, sold),
      reached: sold <= baseSold,
    });
  }
  return out;
}

function impact(before, after) {
  if (!(before > 0)) return 0;
  return (after - before) / before;
}

function emptyQuote(params, baseSold, side) {
  const price = spotPrice(params, baseSold);
  return {
    side,
    baseOut: 0, baseIn: 0, quoteIn: 0, quoteOut: 0, grossQuote: 0, refund: 0,
    creatorFee: 0, protocolFee: 0, avgPrice: price,
    priceBefore: price, priceAfter: price, priceImpact: 0,
    nextSold: baseSold, graduates: false,
  };
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
