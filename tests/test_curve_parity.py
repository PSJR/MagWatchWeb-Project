"""Three-way parity: the contract, the Python mirror and the JS mirror.

The contract is the source of truth. tests/fixtures/curve_cases.json is
generated from the compiled contract itself (see
contracts/scripts/dump-curve-fixtures.js), and both mirrors must reproduce
every value exactly — not approximately. A drift here means the trade panel
promises a number the chain will not deliver.
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

FIXTURES = ROOT / "tests" / "fixtures" / "curve_cases.json"
JS_MODULE = ROOT / "frontend/src/sparkfun/lib/curve.js"


def load_cases():
    if not FIXTURES.exists():
        pytest.skip("fixtures missing — run contracts/scripts/dump-curve-fixtures.js")
    return json.loads(FIXTURES.read_text())["cases"]


def python_result(case):
    p = C.curve_params("ETH", case["mayhem"])
    sold = int(case["base_sold"])
    raised = int(case["quote_raised"])
    amount = int(case["amount"])
    if case["side"] == "buy":
        q = C.quote_buy(p, sold, raised, amount)
        return {
            "base_out": q["base_out"],
            "creator_fee": q["creator_fee"],
            "protocol_fee": q["protocol_fee"],
            "refund": q["refund"],
        }
    q = C.quote_sell(p, sold, raised, amount)
    return {
        "quote_out": q["quote_out"],
        "creator_fee": q["creator_fee"],
        "protocol_fee": q["protocol_fee"],
    }


def test_python_mirror_matches_the_contract():
    for case in load_cases():
        got = python_result(case)
        for key, expected in case["expected"].items():
            assert got[key] == int(expected), (
                f"{case['side']} mayhem={case['mayhem']} amount={case['amount']} "
                f"field {key}: python={got[key]} contract={expected}"
            )


@pytest.mark.skipif(shutil.which("node") is None, reason="node not available")
def test_js_mirror_matches_the_contract():
    script = f"""
import * as C from '{JS_MODULE.as_posix()}';
const cases = {json.dumps(load_cases())};
const out = cases.map((c) => {{
  const p = C.curveParams({{ pair: 'ETH', mayhem: c.mayhem }});
  const sold = BigInt(c.base_sold), raised = BigInt(c.quote_raised), amt = BigInt(c.amount);
  if (c.side === 'buy') {{
    const q = C.quoteBuy(p, sold, raised, amt);
    return {{ base_out: q.baseOut.toString(), creator_fee: q.creatorFee.toString(),
              protocol_fee: q.protocolFee.toString(), refund: q.refund.toString() }};
  }}
  const q = C.quoteSell(p, sold, raised, amt);
  return {{ quote_out: q.quoteOut.toString(), creator_fee: q.creatorFee.toString(),
            protocol_fee: q.protocolFee.toString() }};
}});
console.log(JSON.stringify(out));
"""
    tmp = ROOT / "tests" / "_parity.mjs"
    tmp.write_text(script)
    try:
        proc = subprocess.run(["node", str(tmp)], capture_output=True, text=True, timeout=90, cwd=ROOT)
        if proc.returncode != 0:
            pytest.fail(f"node failed: {proc.stderr[-2000:]}")
        results = json.loads(proc.stdout)
    finally:
        tmp.unlink(missing_ok=True)

    for case, got in zip(load_cases(), results):
        for key, expected in case["expected"].items():
            assert got[key] == expected, (
                f"{case['side']} mayhem={case['mayhem']} amount={case['amount']} "
                f"field {key}: js={got[key]} contract={expected}"
            )


def test_curve_reaches_exactly_the_graduation_target():
    for pair in ("ETH", "USDC"):
        for mayhem in (False, True):
            p = C.curve_params(pair, mayhem)
            # vq0 is derived so the invariant lands on the target at CURVE_SUPPLY.
            vb = p.virtual_base_0 - C.CURVE_SUPPLY
            raised = (p.virtual_base_0 * p.virtual_quote_0) // vb - p.virtual_quote_0
            assert abs(raised - p.graduation_raise) <= 1, (pair, mayhem, raised)


def test_mayhem_is_steeper_but_solvable():
    std = C.curve_params("ETH", False)
    myh = C.curve_params("ETH", True)
    assert myh.virtual_base_0 > C.CURVE_SUPPLY, "mayhem curve must remain solvable"
    assert C.market_cap(myh, 0, 0) < C.market_cap(std, 0, 0)
    assert myh.creator_fee_bps > std.creator_fee_bps
    assert myh.wallet_quote_cap == 0 and std.wallet_quote_cap > 0


def test_wallet_cap_is_a_usable_fraction_of_the_raise():
    """Regression: the cap was once denominated in tokens at 2% of supply,
    which capped a wallet at ~0.06 ETH of a 12 ETH raise."""
    p = C.curve_params("ETH", False)
    assert p.wallet_quote_cap == p.graduation_raise // 10
    assert p.wallet_quote_cap >= C.E18  # at least 1 ETH


def test_overshoot_refunds_and_graduates():
    p = C.curve_params("ETH")
    q = C.quote_buy(p, 0, 0, 10_000 * C.E18)
    assert q["graduates"] is True
    assert q["refund"] > 0
    assert q["quote_in"] + q["refund"] == 10_000 * C.E18


def test_round_trip_costs_only_fees_and_impact():
    p = C.curve_params("ETH")
    buy = C.quote_buy(p, 0, 0, C.E18)
    sell = C.quote_sell(p, buy["next_sold"], buy["next_raised"], buy["base_out"])
    assert sell["quote_out"] < C.E18
    assert sell["quote_out"] > C.E18 * 95 // 100
    assert sell["next_sold"] == 0


def test_sell_cannot_exceed_supply_sold():
    p = C.curve_params("ETH")
    buy = C.quote_buy(p, 0, 0, C.E18 // 10)
    q = C.quote_sell(p, buy["next_sold"], buy["next_raised"], 10**30)
    assert q["base_in"] == buy["next_sold"]
    assert q["next_sold"] == 0
