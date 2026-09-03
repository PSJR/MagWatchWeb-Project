"""spark.fun bonding curve — mirror of contracts/SparkCurve.sol.

The contract is the source of truth and its arithmetic is exact integers, so
this module is integer too. Floats appear only in display helpers, never in a
number that has to agree with settlement.

    base_out  = virtual_base  * quote_in / (virtual_quote + quote_in)
    quote_out = virtual_quote * base_in  / (virtual_base  + base_in)

Those are algebraically identical to `vb - k/(vq + dq)` but need no division to
derive reserves, so nothing is approximated. Rounding matches the contract:
floor on what the trader receives, ceil on what an oversized final buy pays.

tests/test_curve_parity.py pins this file, curve.js and the contract together
against fixtures generated from the compiled contract itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

E18 = 10**18

TOTAL_SUPPLY = 1_000_000_000 * E18
CURVE_SUPPLY = 800_000_000 * E18
LP_SUPPLY = 200_000_000 * E18
BPS = 10_000

STANDARD_VIRTUAL_BASE = 1_073_000_000 * E18
# Mayhem steepens the curve. The floor is CURVE_SUPPLY: below it there is no
# solution. 85% keeps a deliberate margin.
MAYHEM_VIRTUAL_BASE = (1_073_000_000 * E18 * 85) // 100

STANDARD_CREATOR_FEE_BPS = 100
MAYHEM_CREATOR_FEE_BPS = 250
PROTOCOL_FEE_BPS = 50
WALLET_CAP_BPS = 1_000  # 10% of the graduation target

PAIRS: dict[str, dict[str, Any]] = {
    "ETH": {"symbol": "ETH", "decimals": 18, "graduation_raise": 12 * E18},
    "USDC": {"symbol": "USDC", "decimals": 6, "graduation_raise": 36_000 * 10**6},
}

POOL_FEE = 10_000  # 1%, matching SparkCurve.POOL_FEE


class CurveError(ValueError):
    """Raised for trades the curve cannot honour."""


def _ceil_div(a: int, b: int) -> int:
    return -(-a // b)


@dataclass(frozen=True)
class CurveParams:
    pair: str
    decimals: int
    mayhem: bool
    virtual_base_0: int
    virtual_quote_0: int
    graduation_raise: int
    creator_fee_bps: int
    protocol_fee_bps: int
    wallet_quote_cap: int


def curve_params(pair: str = "ETH", mayhem: bool = False) -> CurveParams:
    p = PAIRS.get(pair, PAIRS["ETH"])
    virtual_base_0 = MAYHEM_VIRTUAL_BASE if mayhem else STANDARD_VIRTUAL_BASE
    if virtual_base_0 <= CURVE_SUPPLY:
        raise CurveError("curve unsolvable: virtual_base_0 must exceed CURVE_SUPPLY")
    raise_target = p["graduation_raise"]
    return CurveParams(
        pair=p["symbol"],
        decimals=p["decimals"],
        mayhem=mayhem,
        virtual_base_0=virtual_base_0,
        # Derived exactly as the constructor does.
        virtual_quote_0=(raise_target * (virtual_base_0 - CURVE_SUPPLY)) // CURVE_SUPPLY,
        graduation_raise=raise_target,
        creator_fee_bps=MAYHEM_CREATOR_FEE_BPS if mayhem else STANDARD_CREATOR_FEE_BPS,
        protocol_fee_bps=PROTOCOL_FEE_BPS,
        wallet_quote_cap=0 if mayhem else (raise_target * WALLET_CAP_BPS) // BPS,
    )


def virtual_base(p: CurveParams, base_sold: int) -> int:
    return p.virtual_base_0 - base_sold


def virtual_quote(p: CurveParams, quote_raised: int) -> int:
    return p.virtual_quote_0 + quote_raised


def spot_price(p: CurveParams, base_sold: int, quote_raised: int) -> float:
    """Quote per whole token. Display only — never used for settlement."""
    vb = virtual_base(p, base_sold)
    return 0.0 if vb <= 0 else virtual_quote(p, quote_raised) / vb


def market_cap(p: CurveParams, base_sold: int, quote_raised: int) -> float:
    return spot_price(p, base_sold, quote_raised) * (TOTAL_SUPPLY // E18)


def progress(p: CurveParams, quote_raised: int) -> float:
    if quote_raised >= p.graduation_raise:
        return 1.0
    return ((quote_raised * BPS) // p.graduation_raise) / BPS


def quote_to_graduate(p: CurveParams, quote_raised: int) -> int:
    return max(0, p.graduation_raise - quote_raised)


def quote_buy(p: CurveParams, base_sold: int, quote_raised: int, quote_in: int) -> dict[str, Any]:
    """Mirrors SparkCurve.previewBuy, including the ceil on an oversized buy."""
    if quote_in <= 0:
        return _empty("buy")

    amount = quote_in
    vb = virtual_base(p, base_sold)
    vq = virtual_quote(p, quote_raised)
    net = amount - (amount * p.creator_fee_bps) // BPS - (amount * p.protocol_fee_bps) // BPS

    base_out = (vb * net) // (vq + net)
    refund = 0

    remaining = CURVE_SUPPLY - base_sold
    if base_out > remaining:
        base_out = remaining
        net_needed = _ceil_div(base_out * vq, vb - base_out)
        gross = _ceil_div(net_needed * BPS, BPS - p.creator_fee_bps - p.protocol_fee_bps)
        if gross >= amount:
            gross = amount
        refund = amount - gross
        amount = gross

    creator_fee = (amount * p.creator_fee_bps) // BPS
    protocol_fee = (amount * p.protocol_fee_bps) // BPS
    net_spent = amount - creator_fee - protocol_fee
    next_raised = quote_raised + net_spent
    next_sold = base_sold + base_out

    return {
        "side": "buy",
        "base_out": base_out,
        "quote_in": amount,
        "refund": refund,
        "creator_fee": creator_fee,
        "protocol_fee": protocol_fee,
        "next_sold": next_sold,
        "next_raised": next_raised,
        "graduates": next_raised >= p.graduation_raise or next_sold >= CURVE_SUPPLY,
        "price_before": spot_price(p, base_sold, quote_raised),
        "price_after": spot_price(p, next_sold, next_raised),
    }


def quote_sell(p: CurveParams, base_sold: int, quote_raised: int, base_in: int) -> dict[str, Any]:
    """Mirrors SparkCurve.previewSell."""
    if base_in <= 0:
        return _empty("sell")

    amount = min(base_in, base_sold)
    gross = (virtual_quote(p, quote_raised) * amount) // (virtual_base(p, base_sold) + amount)
    creator_fee = (gross * p.creator_fee_bps) // BPS
    protocol_fee = (gross * p.protocol_fee_bps) // BPS
    next_raised = quote_raised - gross
    next_sold = base_sold - amount

    return {
        "side": "sell",
        "base_in": amount,
        "quote_out": gross - creator_fee - protocol_fee,
        "gross_quote": gross,
        "creator_fee": creator_fee,
        "protocol_fee": protocol_fee,
        "next_sold": next_sold,
        "next_raised": next_raised,
        "graduates": False,
        "price_before": spot_price(p, base_sold, quote_raised),
        "price_after": spot_price(p, next_sold, next_raised),
    }


def graduation_plan(p: CurveParams, quote_raised: int) -> dict[str, Any]:
    """What the Uniswap V3 position looks like when the curve closes."""
    base_sold = p.virtual_base_0 - (p.virtual_base_0 * p.virtual_quote_0) // virtual_quote(p, quote_raised)
    price = spot_price(p, base_sold, quote_raised)
    return {
        "pair": p.pair,
        "quote_liquidity": quote_raised,
        "base_liquidity": LP_SUPPLY,
        "entry_price": price,
        "market_cap": price * (TOTAL_SUPPLY // E18),
        "pool_fee": POOL_FEE,
        "range": "full",
        "locked": True,
    }


def _empty(side: str) -> dict[str, Any]:
    return {
        "side": side, "base_out": 0, "base_in": 0, "quote_in": 0, "quote_out": 0,
        "gross_quote": 0, "refund": 0, "creator_fee": 0, "protocol_fee": 0,
        "next_sold": 0, "next_raised": 0, "graduates": False,
        "price_before": 0.0, "price_after": 0.0,
    }
