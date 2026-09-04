"""The indexer, run against a real chain.

A local node is seeded with a real launch, a dev buy, a buy and a sell
(contracts/scripts/seed-local.js). The indexer then reads those logs and must
reproduce the exact curve state the contract holds. A Mongo double stands in for
the database so the test needs no server, but every value here came off a chain.

Skipped unless the fixture from the seed script is present.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

FIXTURE = Path(
    os.environ.get("SPARK_LOCAL_FIXTURE", "/tmp/claude-0/-home-user-MagWatchWeb-Project/"
                  "5f2e6c79-3386-5075-a51a-7f1ac1340fdd/scratchpad/local.json")
)

def _chain_reachable() -> bool:
    """The fixture file outliving the node it describes is the normal case —
    a laptop reboot is enough. Skipping on an unreachable RPC keeps `make test`
    honest instead of reporting six connection errors as failures."""
    if not FIXTURE.exists():
        return False
    import json as _json
    import urllib.error
    import urllib.request
    try:
        url = _json.loads(FIXTURE.read_text())["rpc"]
        req = urllib.request.Request(
            url,
            data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',
            headers={"content-type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            return b"result" in res.read()
    except (urllib.error.URLError, OSError, KeyError, ValueError, TimeoutError):
        return False


pytestmark = pytest.mark.skipif(
    not _chain_reachable(),
    reason="needs a local node seeded by contracts/scripts/seed-local.js",
)


# --------------------------------------------------------------------------
# a Mongo double: just enough of motor's surface for the indexer
# --------------------------------------------------------------------------

class FakeCursor:
    def __init__(self, rows): self._rows = rows
    def limit(self, n): return FakeCursor(self._rows[:n])
    def sort(self, *a, **k): return self
    def __aiter__(self):
        async def gen():
            for r in self._rows:
                yield r
        return gen()
    async def to_list(self, n=None): return self._rows[:n] if n else self._rows


class FakeCollection:
    def __init__(self): self.docs = []

    @staticmethod
    def _match(doc, query):
        for k, v in query.items():
            if isinstance(v, dict):
                if "$in" in v and doc.get(k) not in v["$in"]: return False
                if "$gt" in v and not (doc.get(k) or 0) > v["$gt"]: return False
            elif doc.get(k) != v:
                return False
        return True

    async def find_one(self, query, projection=None):
        for d in self.docs:
            if self._match(d, query):
                return dict(d)
        return None

    def find(self, query=None, projection=None):
        return FakeCursor([dict(d) for d in self.docs if self._match(d, query or {})])

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def count_documents(self, query):
        return len([d for d in self.docs if self._match(d, query)])

    async def update_one(self, query, update, upsert=False):
        target = next((d for d in self.docs if self._match(d, query)), None)
        if target is None:
            if not upsert:
                return
            target = dict(query)
            for k, v in list(target.items()):
                if isinstance(v, dict):
                    target.pop(k)
            target.update(update.get("$setOnInsert", {}))
            self.docs.append(target)
        target.update(update.get("$set", {}))
        for k, v in update.get("$inc", {}).items():
            target[k] = (target.get(k) or 0) + v


class FakeDb:
    def __init__(self): self._cols = {}
    def __getitem__(self, name):
        return self._cols.setdefault(name, FakeCollection())


# --------------------------------------------------------------------------

@pytest.fixture(scope="module")
def local():
    return json.loads(FIXTURE.read_text())


@pytest.fixture(scope="module")
def indexed(local):
    """Runs the indexer once over the whole local chain."""
    from sparkfun import chain as CH
    from sparkfun.indexer import Indexer

    CH.FACTORY_ADDRESS = local["factory"]
    CH.DEPLOY_BLOCK = 0
    CH.CHAIN_ID = local["chainId"]

    db = FakeDb()
    idx = Indexer(db, CH.Rpc(url=local["rpc"]))

    async def run():
        try:
            count = await idx._scan(0, local["head"])
            return count
        finally:
            await idx.rpc.close()

    events = asyncio.run(run())
    return db, events


def test_it_sees_every_event(indexed):
    _, events = indexed
    # launch + dev buy + buy + sell
    assert events == 4, f"expected 4 events, decoded {events}"


def test_it_indexes_the_launch(indexed, local):
    db, _ = indexed
    tokens = db["sf_tokens"].docs
    assert len(tokens) == 1
    t = tokens[0]
    assert t["address"] == local["token"]
    assert t["curve"] == local["curve"]
    assert t["ticker"] == "PIZZA"
    assert t["name"] == "Pizza da Meia-Noite"
    assert t["pair"] == "ETH"
    assert t["mayhem"] is False
    assert t["metadata_uri"] == "sparkfun:abc"
    assert t["creator_address"].lower() == local["creator"].lower()


def test_curve_state_matches_the_contract_exactly(indexed, local):
    """The indexer takes curve state from the event payload, so it must equal
    what the contract itself reports — not approximately, exactly."""
    db, _ = indexed
    t = db["sf_tokens"].docs[0]
    assert t["base_sold"] == local["baseSold"]
    assert t["quote_raised"] == local["quoteRaised"]


def test_it_records_both_sides_of_the_trade(indexed):
    db, _ = indexed
    trades = db["sf_trades"].docs
    assert len(trades) == 3  # dev buy, buy, sell
    assert [t["side"] for t in trades] == ["buy", "buy", "sell"]
    for t in trades:
        assert t["tx_hash"].startswith("0x")
        assert int(t["quote"]) > 0
        assert int(t["base"]) > 0
        # the exact string and the float shadow must agree
        assert abs(int(t["quote"]) / 1e18 - t["quote_f"]) < 1e-9


def test_positions_net_out_across_buys_and_sells(indexed, local):
    db, _ = indexed
    positions = db["sf_positions"].docs
    assert len(positions) == 2  # creator's dev buy, alice's buy then half sell

    total = sum(p["balance_raw"] for p in positions)
    # Everything still held equals everything the curve has sold.
    assert str(total) == local["baseSold"]


def test_replaying_the_same_range_does_not_double_count(local):
    """Idempotence: a restart, a reorg or a manual backfill must converge."""
    from sparkfun import chain as CH
    from sparkfun.indexer import Indexer

    CH.FACTORY_ADDRESS = local["factory"]
    CH.DEPLOY_BLOCK = 0

    db = FakeDb()
    idx = Indexer(db, CH.Rpc(url=local["rpc"]))

    async def run():
        try:
            await idx._scan(0, local["head"])
            await idx._scan(0, local["head"])  # again
        finally:
            await idx.rpc.close()

    asyncio.run(run())

    assert len(db["sf_tokens"].docs) == 1
    assert len(db["sf_trades"].docs) == 3
    total = sum(p["balance_raw"] for p in db["sf_positions"].docs)
    assert str(total) == local["baseSold"]


def test_it_creates_a_profile_for_every_trader(indexed):
    db, _ = indexed
    users = db["sf_users"].docs
    # creator + alice, even though neither has ever signed in
    assert len(users) == 2
    assert all(u["address"].startswith("0x") for u in users)
    assert len({u["handle"] for u in users}) == 2
