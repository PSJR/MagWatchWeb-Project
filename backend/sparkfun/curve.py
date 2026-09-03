"""spark.fun bonding curve — settlement source of truth.

Constant-product curve over *virtual* reserves:

    k        = virtual_base * virtual_quote
    base_out = virtual_base  - k / (virtual_quote + d_quote)   (buy)
    quote_out= virtual_quote - k / (virtual_base  + d_base)    (sell)
    price    = virtual_quote / virtual_base

The curve sells CURVE_SUPPLY tokens. Once the raise reaches the pair's
graduation target the curve closes and LP_SUPPLY plus the raised quote seed a
permanently locked Uniswap V3 position.

This module mirrors frontend/src/sparkfun/lib/curve.js. The client copy exists
only for instant quote previews; every number that touches a balance is
computed here. tests/test_curve_parity.py pins the two together.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

TOTAL_SUPPLY = 1_000_000_000.0
CURVE_SUPPLY = 800_000_000.0   # sold along the curve
LP_SUPPLY = 200_000_000.0      # seeded into Uniswap V3 at graduation

FEES: dict[str, dict[str, float]] = {
    "standard": {"creator": 0.010, "protocol": 0.005},
    # Mayhem pays the creator more; the protocol cut is unchanged.
    "mayhem": {"creator": 0.025, "protocol": 0.005},
}

WALLET_CAP_SHARE = 0.02  # share of CURVE_SUPPLY; Mayhem removes the cap

PAIRS: dict[str, dict[str, Any]] = {
    "ETH": {
        "symbol": "ETH",
        "decimals": 18,
        "graduation_raise": 12.0,
        "virtual_base_0": 1_073_000_000.0,
    },
    "USDC": {
        "symbol": "USDC",
        "decimals": 6,
        "graduation_raise": 36_000.0,
        "virtual_base_0": 1_073_000_000.0,
    },
}

# Less virtual base => faster price impact. The factor has a hard floor:
# virtual_base_0 must stay above CURVE_SUPPLY or the curve has no solution
# (1_073_000_000 * f > 800_000_000 => f > 0.7456). 0.85 keeps a safe margin
# while roughly halving the starting market cap and doubling the final one.
MAYHEM_STEEPNESS = 0.85


class CurveError(ValueError):
    """Raised for trades the curve cannot honour."""


@dataclass(frozen=True)
class CurveParams:
    pair: str
    mayhem: bool
    virtual_base_0: float
    virtual_quote_0: float
    graduation_raise: float
    fees: dict[str, float] = field(default_factory=dict)
    wallet_cap: float | None = None


def curve_params(pair: str = "ETH", mayhem: bool = False) -> CurveParams:
    """Immutable curve parameters for a token.

    virtual_quote_0 is derived so the curve reaches exactly `graduation_raise`
    at the moment CURVE_SUPPLY has been sold.
    """
    p = PAIRS.get(pair, PAIRS["ETH"])
    virtual_base_0 = p["virtual_base_0"] * (MAYHEM_STEEPNESS if mayhem else 1.0)
    remaining = virtual_base_0 - CURVE_SUPPLY
    if remaining <= 0:
        raise CurveError("curve misconfigured: virtual_base_0 must exceed CURVE_SUPPLY")
    virtual_quote_0 = (p["graduation_raise"] * remaining) / CURVE_SUPPLY
    return CurveParams(
        pair=p["symbol"],
        mayhem=mayhem,
        virtual_base_0=virtual_base_0,
        virtual_quote_0=virtual_quote_0,
        graduation_raise=p["graduation_raise"],
        fees=FEES["mayhem"] if mayhem else FEES["standard"],
        wallet_cap=None if mayhem else CURVE_SUPPLY * WALLET_CAP_SHARE,
    )


def reserves(params: CurveParams, base_sold: float) -> dict[str, float]:
    virtual_base = params.virtual_base_0 - base_sold
    k = params.virtual_base_0 * params.virtual_quote_0
    virtual_quote = k / virtual_base
    return {
        "virtual_base": virtual_base,
        "virtual_quote": virtual_quote,
        "k": k,
        "raised": virtual_quote - params.virtual_quote_0,
    }


def spot_price(params: CurveParams, base_sold: float) -> float:
    r = reserves(params, base_sold)
    return r["virtual_quote"] / r["virtual_base"]


def market_cap(params: CurveParams, base_sold: float) -> float:
    return spot_price(params, base_sold) * TOTAL_SUPPLY


def progress(params: CurveParams, base_sold: float) -> float:
    return max(0.0, min(1.0, base_sold / CURVE_SUPPLY))


def quote_to_graduate(params: CurveParams, base_sold: float) -> float:
    return max(0.0, params.graduation_raise - reserves(params, base_sold)["raised"])


def quote_buy(params: CurveParams, base_sold: float, quote_in: float) -> dict[str, Any]:
    """Quote a buy. `quote_in` is gross; fees come off the top, so the number
    the user types is the number that leaves their wallet."""
    if quote_in is None or quote_in <= 0:
        return _empty(params, base_sold, "buy")

    creator = params.fees["creator"]
    protocol = params.fees["protocol"]
    net = quote_in * (1.0 - creator - protocol)

    r = reserves(params, base_sold)
    base_out = r["virtual_base"] - r["k"] / (r["virtual_quote"] + net)

    # The curve never sells more than it has left; the remainder is refunded.
    available = CURVE_SUPPLY - base_sold
    refund = 0.0
    if base_out > available:
        base_out = available
        quote_needed = r["k"] / (r["virtual_base"] - base_out) - r["virtual_quote"]
        gross_needed = quote_needed / (1.0 - creator - protocol)
        refund = max(0.0, quote_in - gross_needed)

    spend = quote_in - refund
    next_sold = base_sold + base_out
    before = spot_price(params, base_sold)
    after = spot_price(params, next_sold)
    return {
        "side": "buy",
        "base_out": base_out,
        "quote_in": spend,
        "refund": refund,
        "creator_fee": spend * creator,
        "protocol_fee": spend * protocol,
        "avg_price": (spend / base_out) if base_out > 0 else 0.0,
        "price_before": before,
        "price_after": after,
        "price_impact": _impact(before, after),
        "next_sold": next_sold,
        "graduates": next_sold >= CURVE_SUPPLY - 1e-9,
    }


def quote_sell(params: CurveParams, base_sold: float, base_in: float) -> dict[str, Any]:
    """Quote a sell. `base_in` is tokens sold; fees come off the proceeds."""
    if base_in is None or base_in <= 0:
        return _empty(params, base_sold, "sell")

    amount = min(base_in, base_sold)
    r = reserves(params, base_sold)
    gross = r["virtual_quote"] - r["k"] / (r["virtual_base"] + amount)

    creator = params.fees["creator"]
    protocol = params.fees["protocol"]
    creator_fee = gross * creator
    protocol_fee = gross * protocol
    next_sold = base_sold - amount
    before = spot_price(params, base_sold)
    after = spot_price(params, next_sold)
    return {
        "side": "sell",
        "base_in": amount,
        "quote_out": gross - creator_fee - protocol_fee,
        "gross_quote": gross,
        "creator_fee": creator_fee,
        "protocol_fee": protocol_fee,
        "avg_price": (gross / amount) if amount > 0 else 0.0,
        "price_before": before,
        "price_after": after,
        "price_impact": _impact(before, after),
        "next_sold": next_sold,
        "graduates": False,
    }


def curve_samples(params: CurveParams, base_sold: float, points: int = 64) -> list[dict[str, float]]:
    out = []
    for i in range(points + 1):
        sold = CURVE_SUPPLY * i / points
        out.append({
            "sold": sold,
            "progress": sold / CURVE_SUPPLY,
            "price": spot_price(params, sold),
            "cap": market_cap(params, sold),
            "reached": sold <= base_sold,
        })
    return out


def graduation_plan(params: CurveParams, base_sold: float) -> dict[str, Any]:
    """What the Uniswap V3 position looks like the moment the curve closes."""
    r = reserves(params, base_sold)
    price = spot_price(params, base_sold)
    return {
        "pair": params.pair,
        "quote_liquidity": r["raised"],
        "base_liquidity": LP_SUPPLY,
        "entry_price": price,
        "market_cap": price * TOTAL_SUPPLY,
        "range": "full",
        "locked": True,
    }


def _impact(before: float, after: float) -> float:
    if before <= 0:
        return 0.0
    return (after - before) / before


def _empty(params: CurveParams, base_sold: float, side: str) -> dict[str, Any]:
    price = spot_price(params, base_sold)
    return {
        "side": side,
        "base_out": 0.0, "base_in": 0.0, "quote_in": 0.0, "quote_out": 0.0,
        "gross_quote": 0.0, "refund": 0.0, "creator_fee": 0.0, "protocol_fee": 0.0,
        "avg_price": price, "price_before": price, "price_after": price,
        "price_impact": 0.0, "next_sold": base_sold, "graduates": False,
    }
