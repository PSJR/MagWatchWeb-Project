"""The JS and Python curves must agree — the client quotes, the server settles.

If these drift, a user sees one number in the trade panel and a different one
in their wallet. The tolerance is float noise only.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sparkfun import curve as C  # noqa: E402

JS_MODULE = ROOT / "frontend/src/sparkfun/lib/curve.js"
TOLERANCE = 1e-9

CASES = [
    ("ETH", False, 0.0, "buy", 0.05),
    ("ETH", False, 0.0, "buy", 1.5),
    ("ETH", False, 120_000_000.0, "buy", 0.4),
    ("ETH", False, 400_000_000.0, "sell", 5_000_000.0),
    ("ETH", False, 799_000_000.0, "buy", 100.0),   # overshoot -> refund + graduate
    ("ETH", True, 50_000_000.0, "buy", 0.25),      # mayhem curve
    ("USDC", False, 200_000_000.0, "buy", 900.0),
    ("USDC", False, 200_000_000.0, "sell", 1_000_000.0),
]


def _python_results():
    out = []
    for pair, mayhem, sold, side, amount in CASES:
        p = C.curve_params(pair, mayhem)
        q = C.quote_buy(p, sold, amount) if side == "buy" else C.quote_sell(p, sold, amount)
        out.append({
            "base": q.get("base_out") or q.get("base_in") or 0.0,
            "quote": q.get("quote_in") if side == "buy" else q.get("quote_out"),
            "creator_fee": q["creator_fee"],
            "protocol_fee": q["protocol_fee"],
            "price_after": q["price_after"],
            "refund": q.get("refund", 0.0),
            "graduates": q["graduates"],
        })
    return out


def _js_results():
    script = f"""
import * as C from '{JS_MODULE.as_posix()}';
const cases = {json.dumps(CASES)};
const out = cases.map(([pair, mayhem, sold, side, amount]) => {{
  const p = C.curveParams({{ pair, mayhem }});
  const q = side === 'buy' ? C.quoteBuy(p, sold, amount) : C.quoteSell(p, sold, amount);
  return {{
    base: q.baseOut || q.baseIn || 0,
    quote: side === 'buy' ? q.quoteIn : q.quoteOut,
    creator_fee: q.creatorFee,
    protocol_fee: q.protocolFee,
    price_after: q.priceAfter,
    refund: q.refund || 0,
    graduates: q.graduates,
  }};
}});
console.log(JSON.stringify(out));
"""
    tmp = ROOT / "tests" / "_parity.mjs"
    tmp.write_text(script)
    try:
        proc = subprocess.run(
            ["node", str(tmp)], capture_output=True, text=True, timeout=60, cwd=ROOT
        )
        if proc.returncode != 0:
            pytest.fail(f"node failed: {proc.stderr[-2000:]}")
        return json.loads(proc.stdout)
    finally:
        tmp.unlink(missing_ok=True)


@pytest.mark.skipif(shutil.which("node") is None, reason="node not available")
def test_js_and_python_curves_agree():
    py, js = _python_results(), _js_results()
    assert len(py) == len(js)
    for i, (a, b) in enumerate(zip(py, js)):
        case = CASES[i]
        for key in ("base", "quote", "creator_fee", "protocol_fee", "price_after", "refund"):
            av, bv = a[key], b[key]
            scale = max(1.0, abs(av))
            assert abs(av - bv) / scale < TOLERANCE, (
                f"case {case} field {key}: python={av!r} js={bv!r}"
            )
        assert a["graduates"] == b["graduates"], f"case {case}: graduation flag differs"


def test_curve_reaches_exactly_the_graduation_target():
    for pair in ("ETH", "USDC"):
        for mayhem in (False, True):
            p = C.curve_params(pair, mayhem)
            raised = C.reserves(p, C.CURVE_SUPPLY)["raised"]
            assert raised == pytest.approx(p.graduation_raise, rel=1e-12)


def test_mayhem_is_steeper_but_solvable():
    std = C.curve_params("ETH", False)
    myh = C.curve_params("ETH", True)
    assert myh.virtual_base_0 > C.CURVE_SUPPLY, "mayhem curve must remain solvable"
    assert C.market_cap(myh, 0) < C.market_cap(std, 0)
    assert C.market_cap(myh, C.CURVE_SUPPLY) > C.market_cap(std, C.CURVE_SUPPLY)
    assert myh.fees["creator"] > std.fees["creator"]
    assert myh.wallet_cap is None and std.wallet_cap is not None


def test_overshoot_refunds_and_graduates():
    p = C.curve_params("ETH")
    q = C.quote_buy(p, 0.0, 10_000.0)
    assert q["graduates"] is True
    assert q["refund"] > 0
    assert q["base_out"] == pytest.approx(C.CURVE_SUPPLY, rel=1e-12)
    assert q["quote_in"] + q["refund"] == pytest.approx(10_000.0, rel=1e-12)


def test_round_trip_costs_only_fees_and_impact():
    p = C.curve_params("ETH")
    buy = C.quote_buy(p, 0.0, 1.0)
    sell = C.quote_sell(p, buy["next_sold"], buy["base_out"])
    assert sell["quote_out"] < 1.0
    assert sell["quote_out"] > 0.95  # 1.5% of fees each way, plus impact
    assert sell["next_sold"] == pytest.approx(0.0, abs=1e-6)


def test_sell_cannot_exceed_supply_sold():
    p = C.curve_params("ETH")
    q = C.quote_sell(p, 1_000.0, 999_999_999.0)
    assert q["base_in"] == pytest.approx(1_000.0)
    assert q["next_sold"] == pytest.approx(0.0)
