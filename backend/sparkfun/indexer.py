"""Chain indexer.

The chain is the source of truth; this turns its events into the documents the
app reads for discovery, history and profiles. It never writes to the chain and
holds no key.

Ordering and restarts are handled by a cursor plus idempotent writes: every
trade is keyed by (tx_hash, log_index), so replaying a range — after a crash, a
reorg, or a manual backfill — converges on the same state instead of double
counting.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from . import chain as CH
from . import curve as C
from . import service as S

log = logging.getLogger("sparkfun.indexer")

TOKENS = "sf_tokens"
TRADES = "sf_trades"
POSITIONS = "sf_positions"
USERS = "sf_users"
CURSOR = "sf_cursor"

POLL_SECONDS = 2.0
# Blocks are ~100ms, so a reorg window of a few hundred blocks is still only
# seconds of wall time. Re-scanning it every pass is cheap and makes the
# indexer self-healing.
REORG_BUFFER = 300


class Indexer:
    def __init__(self, db: Any, rpc: Optional[CH.Rpc] = None) -> None:
        self.db = db
        self.rpc = rpc or CH.Rpc()
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self.last_block = 0
        self.running = False

    # ---- lifecycle ------------------------------------------------------

    async def start(self) -> None:
        if not CH.configured():
            log.warning("spark.fun indexer idle: SPARK_FACTORY_ADDRESS is not set")
            return
        chain_id = await self.rpc.chain_id()
        if chain_id != CH.CHAIN_ID:
            raise RuntimeError(
                f"RPC reports chain {chain_id}, expected {CH.CHAIN_ID} — refusing to index"
            )
        self._task = asyncio.create_task(self._loop())
        self.running = True
        log.info("spark.fun indexer started on chain %s", chain_id)

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        await self.rpc.close()
        self.running = False

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self.tick()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.warning("indexer tick failed: %s", exc)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=POLL_SECONDS)
            except asyncio.TimeoutError:
                pass

    # ---- scanning -------------------------------------------------------

    async def _cursor(self) -> int:
        doc = await self.db[CURSOR].find_one({"_id": "blocks"})
        if doc and doc.get("block"):
            return int(doc["block"])
        return CH.DEPLOY_BLOCK

    async def _save_cursor(self, block: int) -> None:
        await self.db[CURSOR].update_one(
            {"_id": "blocks"}, {"$set": {"block": block, "at": datetime.now(timezone.utc)}}, upsert=True
        )

    async def tick(self) -> int:
        head = await self.rpc.block_number()
        cursor = await self._cursor()
        start = max(CH.DEPLOY_BLOCK, cursor - REORG_BUFFER)
        if start > head:
            return 0

        processed = 0
        for lo, hi in CH.chunks(start, head):
            processed += await self._scan(lo, hi)
        self.last_block = head
        await self._save_cursor(head)
        return processed

    async def _scan(self, from_block: int, to_block: int) -> int:
        # Factory events come from one address; curve events come from every
        # curve, so they are matched by topic across all addresses.
        launches = await self.rpc.get_logs(
            address=CH.FACTORY_ADDRESS,
            topics=[CH.TOPICS["TokenLaunched"]],
            from_block=from_block, to_block=to_block,
        )
        curve_logs = await self.rpc.get_logs(
            address=None,
            topics=[[CH.TOPICS["Bought"], CH.TOPICS["Sold"], CH.TOPICS["Graduated"]]],
            from_block=from_block, to_block=to_block,
        )

        events = [e for e in (CH.decode_log(l) for l in launches + curve_logs) if e]
        events.sort(key=lambda e: (e["block"], e["log_index"]))

        known_curves: set[str] = set()
        for event in events:
            if event["event"] == "TokenLaunched":
                await self._on_launch(event)
                known_curves.add(event["curve"])
            else:
                # Ignore curve events from contracts this factory did not
                # deploy: anyone can emit an identical event.
                if event["address"] not in known_curves:
                    doc = await self.db[TOKENS].find_one(
                        {"curve": event["address"]}, {"_id": 0, "curve": 1}
                    )
                    if not doc:
                        continue
                    known_curves.add(event["address"])
                if event["event"] in ("Bought", "Sold"):
                    await self._on_trade(event)
                elif event["event"] == "Graduated":
                    await self._on_graduation(event)
        return len(events)

    # ---- handlers -------------------------------------------------------

    async def _on_launch(self, e: dict) -> None:
        existing = await self.db[TOKENS].find_one({"address": e["token"]}, {"_id": 0, "address": 1})
        if existing:
            return

        ts = datetime.fromtimestamp(await self.rpc.block_timestamp(e["block"]), tz=timezone.utc)
        creator = await self._user_for(e["creator"])
        pair = "USDC" if int(e["quote_token"], 16) != 0 else "ETH"

        await self.db[TOKENS].update_one(
            {"address": e["token"]},
            {"$setOnInsert": {
                "address": e["token"],
                "curve": e["curve"],
                "ticker": e["symbol"],
                "name": e["name"],
                "description": "",
                "image_url": None,
                "banner_url": None,
                "media_type": "image",
                "links": {},
                "metadata_uri": e["metadata_uri"],
                "pair": pair,
                "quote_token": e["quote_token"],
                "mayhem": e["mayhem"],
                "status": "live",
                "creator_id": creator["id"],
                "creator_handle": creator["handle"],
                "creator_address": e["creator"],
                "created_at": ts,
                "created_block": e["block"],
                "created_tx": e["tx_hash"],
                "last_trade_at": None,
                "base_sold": "0",
                "quote_raised": "0",
                "base_sold_f": 0.0,
                "quote_raised_f": 0.0,
                "creator_fees": 0.0,
                "pool_address": None,
            }},
            upsert=True,
        )
        await self.db[USERS].update_one({"id": creator["id"]}, {"$set": {"is_creator": True}})
        log.info("indexed launch %s (%s)", e["symbol"], e["token"])

    async def _on_trade(self, e: dict) -> None:
        token = await self.db[TOKENS].find_one({"curve": e["address"]}, {"_id": 0})
        if not token:
            return

        trade_id = f"{e['tx_hash']}:{e['log_index']}"
        # Idempotent: replaying a range cannot double count.
        prior = await self.db[TRADES].find_one({"id": trade_id}, {"_id": 0, "id": 1})

        ts = datetime.fromtimestamp(await self.rpc.block_timestamp(e["block"]), tz=timezone.utc)
        user = await self._user_for(e["trader"])

        if not prior:
            # uint256 does not fit any numeric BSON type (Decimal128 tops out
            # at 34 digits), so the exact value is stored as a string and a
            # float shadow is kept purely so Mongo can $sum for volume charts.
            decimals = 6 if token.get("pair") == "USDC" else 18
            await self.db[TRADES].insert_one({
                "id": trade_id,
                "token_address": token["address"],
                "curve": e["address"],
                "ticker": token["ticker"],
                "user_id": user["id"],
                "handle": user["handle"],
                "nickname": user.get("nickname"),
                "trader": e["trader"],
                "side": e["side"],
                "base": str(e["base"]),
                "quote": str(e["quote"]),
                "creator_fee": str(e["creator_fee"]),
                "protocol_fee": str(e["protocol_fee"]),
                "quote_f": e["quote"] / 10 ** decimals,
                "base_f": e["base"] / 10 ** 18,
                "creator_fee_f": e["creator_fee"] / 10 ** decimals,
                "price_f": (e["quote"] / 10 ** decimals) / (e["base"] / 10 ** 18) if e["base"] else 0.0,
                "tx_hash": e["tx_hash"],
                "log_index": e["log_index"],
                "block": e["block"],
                "ts": ts,
            })

            delta = int(e["base"]) if e["side"] == "buy" else -int(e["base"])
            await self.db[POSITIONS].update_one(
                {"user_id": user["id"], "token_address": token["address"]},
                {
                    "$inc": {"balance_raw": delta, "balance_f": delta / 10 ** 18},
                    "$setOnInsert": {"first_trade_at": ts, "handle": user["handle"], "address": e["trader"]},
                },
                upsert=True,
            )

        # Curve state comes from the event itself, so it is always the value the
        # chain committed rather than something recomputed here.
        await self.db[TOKENS].update_one(
            {"address": token["address"]},
            {"$set": {
                "base_sold": str(e["base_sold"]),
                "quote_raised": str(e["quote_raised"]),
                "base_sold_f": e["base_sold"] / 10 ** 18,
                "quote_raised_f": e["quote_raised"] / 10 ** (6 if token.get("pair") == "USDC" else 18),
                "last_trade_at": ts,
                "last_block": e["block"],
            }},
        )

    async def _on_graduation(self, e: dict) -> None:
        token = await self.db[TOKENS].find_one({"curve": e["address"]}, {"_id": 0, "address": 1})
        if not token:
            return
        ts = datetime.fromtimestamp(await self.rpc.block_timestamp(e["block"]), tz=timezone.utc)
        await self.db[TOKENS].update_one(
            {"address": token["address"]},
            {"$set": {
                "status": "graduated",
                "graduated_at": ts,
                "pool_address": e["pool"],
                "position_token_id": str(e["position_token_id"]),
                "graduation_tx": e["tx_hash"],
            }},
        )
        log.info("indexed graduation %s -> pool %s", token["address"], e["pool"])

    async def _user_for(self, address: str) -> dict:
        """Every address that touches the protocol gets a profile, whether or
        not it has ever signed in — otherwise a trader would vanish from the
        feed until they logged in."""
        addr = address.lower()
        user = await self.db[USERS].find_one({"address": addr}, {"_id": 0})
        if user:
            return user

        taken = set()
        async for row in self.db[USERS].find({}, {"_id": 0, "handle": 1}).limit(5000):
            taken.add(row["handle"])
        handle = S.handle_from(addr, None, taken)
        count = await self.db[USERS].count_documents({})
        user = {
            "id": S.new_id(), "handle": handle, "nickname": handle, "address": addr,
            "email": None, "avatar_url": None, "banner_theme": "hearth", "bio": None,
            "mood": "cozy", "created_at": datetime.now(timezone.utc),
            "is_creator": False, "verified_creator": False, "follower_count": 0,
            "favorites": [], "signup_index": count, "show_absolute_pnl": False,
        }
        await self.db[USERS].insert_one(dict(user))
        user.pop("_id", None)
        return user


_indexer: Optional[Indexer] = None


def get_indexer() -> Optional[Indexer]:
    return _indexer


async def start_indexer(db: Any) -> Optional[Indexer]:
    global _indexer
    if _indexer is not None:
        return _indexer
    _indexer = Indexer(db)
    await _indexer.start()
    return _indexer


async def stop_indexer() -> None:
    global _indexer
    if _indexer:
        await _indexer.stop()
        _indexer = None
