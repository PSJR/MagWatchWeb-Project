"""spark.fun API — mounted under /api/sf by backend/server.py."""

from __future__ import annotations

import asyncio
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from . import curve as C
from . import service as S
from .models import (
    CommentIn, CommentOut, CreatorStats, GuestIn, HolderOut, NonceOut, PlatformStats,
    PositionOut, QuoteIn, Session, TokenCreate, TokenOut, TradeIn, TradeOut,
    UserPatch, UserProfile, UserPublic, VerifyIn, utcnow,
)

router = APIRouter(prefix="/sf", tags=["spark.fun"])
security = HTTPBearer(auto_error=False)

SECRET_KEY = os.environ.get("SECRET_KEY", "sparkfun-dev-key-change-in-production")
ALGORITHM = "HS256"
SESSION_DAYS = 30
NONCE_TTL = timedelta(minutes=10)

# Collections are namespaced so spark.fun can share a database cleanly.
USERS = "sf_users"
TOKENS = "sf_tokens"
TRADES = "sf_trades"
POSITIONS = "sf_positions"
COMMENTS = "sf_comments"
FOLLOWS = "sf_follows"
NONCES = "sf_nonces"

_db: Any = None


def bind(db: Any) -> None:
    """Called once at startup with the Motor database handle."""
    global _db
    _db = db


def db() -> Any:
    if _db is None:  # pragma: no cover - misconfiguration only
        raise RuntimeError("spark.fun routes used before bind(db)")
    return _db


async def ensure_indexes() -> None:
    d = db()
    await d[USERS].create_index("handle", unique=True)
    await d[USERS].create_index("address", sparse=True)
    await d[TOKENS].create_index("address", unique=True)
    await d[TOKENS].create_index("ticker")
    await d[TOKENS].create_index([("created_at", -1)])
    await d[TOKENS].create_index([("last_trade_at", -1)])
    await d[TRADES].create_index([("token_address", 1), ("ts", -1)])
    await d[TRADES].create_index([("ts", -1)])
    await d[TRADES].create_index([("user_id", 1), ("ts", -1)])
    await d[POSITIONS].create_index([("user_id", 1), ("token_address", 1)], unique=True)
    await d[POSITIONS].create_index("token_address")
    await d[COMMENTS].create_index([("token_address", 1), ("ts", -1)])
    await d[NONCES].create_index("created_at", expireAfterSeconds=int(NONCE_TTL.total_seconds()))


# --------------------------------------------------------------------------
# live feed hub
# --------------------------------------------------------------------------

class Hub:
    """In-process fan-out for the live feed.

    Single-worker only. Running more than one uvicorn worker needs a Redis (or
    Mongo change-stream) pub/sub behind this same interface — the sockets would
    otherwise only see events raised by their own process.
    """

    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def join(self, channel: str, ws: WebSocket) -> None:
        async with self._lock:
            self._channels.setdefault(channel, set()).add(ws)

    async def leave(self, channel: str, ws: WebSocket) -> None:
        async with self._lock:
            peers = self._channels.get(channel)
            if peers:
                peers.discard(ws)
                if not peers:
                    self._channels.pop(channel, None)

    async def publish(self, channel: str, event: dict) -> None:
        async with self._lock:
            peers = list(self._channels.get(channel, ()))
        if not peers:
            return
        payload = json.dumps(event, default=str)
        dead = []
        for ws in peers:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.leave(channel, ws)


hub = Hub()


async def broadcast(event: dict, token_address: Optional[str] = None) -> None:
    await hub.publish("global", event)
    if token_address:
        await hub.publish(f"token:{token_address}", event)


@router.websocket("/live")
async def live(ws: WebSocket, channel: str = Query("global")) -> None:
    await ws.accept()
    await hub.join(channel, ws)
    try:
        await ws.send_text(json.dumps({"type": "hello", "channel": channel, "chain_id": 4663}))
        while True:
            # Client sends nothing but pings; this keeps the socket honest.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await hub.leave(channel, ws)


# --------------------------------------------------------------------------
# auth
# --------------------------------------------------------------------------

def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": utcnow() + timedelta(days=SESSION_DAYS), "scope": "sparkfun"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    return await db()[USERS].find_one({"id": payload.get("sub")}, {"_id": 0})


async def current_user(user: Optional[dict] = Depends(current_user_optional)) -> dict:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Entre na casa para fazer isso.")
    return user


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "handle": u["handle"], "nickname": u.get("nickname") or u["handle"],
        "address": u.get("address"), "avatar_url": u.get("avatar_url"),
        "banner_theme": u.get("banner_theme", "hearth"), "bio": u.get("bio"),
        "mood": u.get("mood", "cozy"), "created_at": u["created_at"],
        "is_creator": bool(u.get("is_creator")), "follower_count": u.get("follower_count", 0),
        "verified_creator": bool(u.get("verified_creator")),
    }


async def _unique_handle(address: Optional[str], email: Optional[str]) -> str:
    stem_taken: set[str] = set()
    async for row in db()[USERS].find({}, {"_id": 0, "handle": 1}).limit(5000):
        stem_taken.add(row["handle"])
    return S.handle_from(address, email, stem_taken)


async def _create_user(*, address: Optional[str] = None, email: Optional[str] = None,
                       nickname: Optional[str] = None) -> dict:
    handle = await _unique_handle(address, email)
    count = await db()[USERS].count_documents({})
    user = {
        "id": S.new_id(),
        "handle": handle,
        "nickname": nickname or handle,
        "address": address.lower() if address else None,
        "email": email,
        "avatar_url": None,
        "banner_theme": "hearth",
        "bio": None,
        "mood": "cozy",
        "created_at": utcnow(),
        "is_creator": False,
        "verified_creator": False,
        "follower_count": 0,
        "favorites": [],
        "signup_index": count,
        "show_absolute_pnl": False,
    }
    await db()[USERS].insert_one(dict(user))
    user.pop("_id", None)
    return user


@router.get("/auth/nonce", response_model=NonceOut)
async def auth_nonce(address: str = Query(..., min_length=42, max_length=42)) -> Any:
    nonce = secrets.token_hex(16)
    await db()[NONCES].insert_one(
        {"address": address.lower(), "nonce": nonce, "created_at": utcnow()}
    )
    return {"address": address, "nonce": nonce, "message": S.siwe_message(address, nonce)}


@router.post("/auth/verify", response_model=Session)
async def auth_verify(payload: VerifyIn) -> Any:
    record = await db()[NONCES].find_one_and_delete(
        {"address": payload.address.lower(), "nonce": payload.nonce}
    )
    if not record:
        raise HTTPException(400, "Esse desafio expirou. Tente conectar de novo.")

    message = S.siwe_message(payload.address, payload.nonce)
    verified = S.verify_signature(payload.address, message, payload.signature)
    if not verified and os.environ.get("SPARKFUN_REQUIRE_SIGNATURE", "true").lower() == "true":
        raise HTTPException(401, "Não consegui conferir a assinatura dessa carteira.")

    user = await db()[USERS].find_one({"address": payload.address.lower()}, {"_id": 0})
    if not user:
        user = await _create_user(address=payload.address)
    return {"token": make_token(user["id"]), "user": public_user(user), "signature_verified": verified}


@router.post("/auth/guest", response_model=Session)
async def auth_guest(payload: GuestIn) -> Any:
    email = payload.email.strip().lower()
    if "@" not in email or len(email) < 5:
        raise HTTPException(400, "Esse e-mail não parece certo.")
    user = await db()[USERS].find_one({"email": email}, {"_id": 0})
    if not user:
        user = await _create_user(email=email, nickname=payload.nickname)
    return {"token": make_token(user["id"]), "user": public_user(user), "signature_verified": False}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(current_user)) -> Any:
    return public_user(user)


@router.patch("/me", response_model=UserPublic)
async def patch_me(patch: UserPatch, user: dict = Depends(current_user)) -> Any:
    updates = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if updates:
        await db()[USERS].update_one({"id": user["id"]}, {"$set": updates})
        user = await db()[USERS].find_one({"id": user["id"]}, {"_id": 0})
    return public_user(user)


# --------------------------------------------------------------------------
# tokens & discovery
# --------------------------------------------------------------------------

SORTS = {
    "movers": [("volume_24h", -1)],
    "new": [("created_at", -1)],
    "mcap": [("base_sold", -1)],
    "last_trade": [("last_trade_at", -1)],
    "almost": [("base_sold", -1)],
}


async def _token_stats(addresses: list[str]) -> dict[str, dict]:
    """24h volume, trade count and holder count for a batch of tokens."""
    if not addresses:
        return {}
    since = utcnow() - timedelta(hours=24)
    out: dict[str, dict] = {a: {"volume_24h": 0.0, "trades": 0, "holders": 0} for a in addresses}

    cursor = db()[TRADES].aggregate([
        {"$match": {"token_address": {"$in": addresses}, "ts": {"$gte": since}}},
        {"$group": {"_id": "$token_address", "vol": {"$sum": "$quote"}, "n": {"$sum": 1},
                    "first": {"$first": "$price"}, "last": {"$last": "$price"}}},
    ])
    async for row in cursor:
        out[row["_id"]].update(volume_24h=row["vol"], trades=row["n"])
        if row.get("first"):
            out[row["_id"]]["change_24h"] = (row["last"] - row["first"]) / row["first"]

    holders = db()[POSITIONS].aggregate([
        {"$match": {"token_address": {"$in": addresses}, "balance": {"$gt": 0}}},
        {"$group": {"_id": "$token_address", "n": {"$sum": 1}}},
    ])
    async for row in holders:
        out[row["_id"]]["holders"] = row["n"]
    return out


async def _project_many(docs: list[dict]) -> list[dict]:
    stats = await _token_stats([d["address"] for d in docs])
    return [S.project_token(d, stats=stats.get(d["address"], {})) for d in docs]


@router.get("/tokens", response_model=list[TokenOut])
async def list_tokens(
    sort: str = Query("movers"),
    mayhem: Optional[bool] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    creator: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    skip: int = Query(0, ge=0),
) -> Any:
    query: dict[str, Any] = {}
    if mayhem is not None:
        query["mayhem"] = mayhem
    if status_filter in ("live", "graduated", "dead"):
        query["status"] = status_filter
    if creator:
        query["creator_handle"] = creator
    if q:
        query["$or"] = [
            {"ticker": {"$regex": q.upper().lstrip("$"), "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
        ]
    # "Quase lá" is the signature filter: tokens on the edge of graduating.
    if sort == "almost":
        query["status"] = "live"
        query["base_sold"] = {"$gte": C.CURVE_SUPPLY * 0.85}

    docs = await db()[TOKENS].find(query, {"_id": 0}).sort(
        SORTS.get(sort, SORTS["movers"])
    ).skip(skip).limit(limit).to_list(limit)
    return await _project_many(docs)


@router.get("/tokens/ticker/{ticker}")
async def ticker_available(ticker: str) -> Any:
    clean = ticker.strip().upper().lstrip("$")
    existing = await db()[TOKENS].find_one({"ticker": clean}, {"_id": 0, "address": 1})
    suggestions = []
    if existing:
        for candidate in (f"{clean}2", f"{clean}X", f"{clean}FUN"):
            if not await db()[TOKENS].find_one({"ticker": candidate}, {"_id": 0, "address": 1}):
                suggestions.append(candidate)
    return {"ticker": clean, "available": existing is None, "suggestions": suggestions[:2]}


@router.get("/tokens/{address}", response_model=TokenOut)
async def get_token(address: str) -> Any:
    doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Não achei esse token por aqui.")
    creator = await db()[USERS].find_one({"id": doc["creator_id"]}, {"_id": 0})
    stats = await _token_stats([address])
    return S.project_token(doc, creator=creator, stats=stats.get(address, {}))


@router.post("/tokens", response_model=TokenOut, status_code=201)
async def create_token(payload: TokenCreate, user: dict = Depends(current_user)) -> Any:
    existing = await db()[TOKENS].find_one({"ticker": payload.ticker}, {"_id": 0, "address": 1})
    if existing:
        raise HTTPException(409, f"${payload.ticker} já está aceso.")

    created_at = utcnow()
    address = S.token_address(user["id"], payload.ticker, created_at)
    doc = {
        "address": address,
        "ticker": payload.ticker,
        "name": payload.name,
        "description": payload.description or "",
        "image_url": payload.image_url,
        "banner_url": payload.banner_url,
        "media_type": payload.media_type,
        "links": payload.links.model_dump(exclude_none=True),
        "pair": payload.pair,
        "mayhem": payload.mayhem,
        "status": "live",
        "creator_id": user["id"],
        "creator_handle": user["handle"],
        "created_at": created_at,
        "last_trade_at": None,
        "base_sold": 0.0,
        "volume_24h": 0.0,
        "creator_fees": 0.0,
        "pool_address": None,
    }
    await db()[TOKENS].insert_one(dict(doc))
    if not user.get("is_creator"):
        await db()[USERS].update_one({"id": user["id"]}, {"$set": {"is_creator": True}})

    if payload.dev_buy > 0:
        await _execute_trade(doc, user, side="buy", amount=payload.dev_buy, slippage=0.5)
        doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0})

    projected = S.project_token(doc, creator=user)
    await broadcast({"type": "token.created", "token": projected}, address)
    return projected


# --------------------------------------------------------------------------
# trading
# --------------------------------------------------------------------------

@router.post("/tokens/{address}/quote")
async def quote_trade(address: str, payload: QuoteIn) -> Any:
    doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Não achei esse token por aqui.")
    p = S.params_for(doc)
    sold = float(doc.get("base_sold", 0))
    q = C.quote_buy(p, sold, payload.amount) if payload.side == "buy" else C.quote_sell(p, sold, payload.amount)
    q["pair"] = doc.get("pair", "ETH")
    q["progress_after"] = C.progress(p, q["next_sold"])
    return q


async def _execute_trade(token: dict, user: dict, *, side: str, amount: float,
                         slippage: float, min_out: Optional[float] = None) -> dict:
    """Settle a trade against the curve.

    Concurrency: the curve state is the single mutable field that matters, so
    the write is conditional on base_sold being exactly what we quoted against.
    A racing trade changes it, the update matches nothing, and we retry with
    fresh state rather than settling at a stale price.
    """
    address = token["address"]

    for _ in range(5):
        doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Não achei esse token por aqui.")
        if doc["status"] == "graduated":
            raise HTTPException(409, "Esse token já graduou — negocie na pool do Uniswap V3.")

        p = S.params_for(doc)
        sold = float(doc.get("base_sold", 0.0))

        position = await db()[POSITIONS].find_one(
            {"user_id": user["id"], "token_address": address}, {"_id": 0}
        ) or {"balance": 0.0, "cost_basis": 0.0, "realized_pnl": 0.0}

        if side == "buy":
            q = C.quote_buy(p, sold, amount)
            if q["base_out"] <= 0:
                raise HTTPException(400, "Esse valor é pequeno demais para render tokens.")
            if p.wallet_cap is not None and position["balance"] + q["base_out"] > p.wallet_cap:
                raise HTTPException(
                    400,
                    "Isso passa do limite por carteira desse token. "
                    "Tokens em Fogo Selvagem não têm limite.",
                )
            if min_out is not None and q["base_out"] < min_out:
                raise HTTPException(409, "O preço mexeu mais que o combinado. Tente com margem maior.")
            delta_balance = q["base_out"]
            delta_cost = q["quote_in"]
            realized = 0.0
            quote_moved = q["quote_in"]
        else:
            if position["balance"] <= 0:
                raise HTTPException(400, "Você não tem esse token para vender.")
            sell_amount = min(amount, position["balance"])
            q = C.quote_sell(p, sold, sell_amount)
            if min_out is not None and q["quote_out"] < min_out:
                raise HTTPException(409, "O preço mexeu mais que o combinado. Tente com margem maior.")
            share = sell_amount / position["balance"] if position["balance"] else 0.0
            delta_cost = -position["cost_basis"] * share
            realized = q["quote_out"] + delta_cost  # delta_cost is negative here
            delta_balance = -sell_amount
            quote_moved = q["quote_out"]

        next_sold = q["next_sold"]
        graduates = bool(q.get("graduates"))

        token_updates: dict[str, Any] = {
            "base_sold": next_sold,
            "last_trade_at": utcnow(),
        }
        if graduates:
            token_updates["status"] = "graduated"
            token_updates["graduated_at"] = utcnow()
            token_updates["pool_address"] = S.token_address(
                doc["creator_id"], f"{doc['ticker']}-POOL", doc["created_at"]
            )

        result = await db()[TOKENS].update_one(
            {"address": address, "base_sold": sold, "status": doc["status"]},
            {"$set": token_updates,
             "$inc": {"creator_fees": q["creator_fee"], "volume_24h": quote_moved}},
        )
        if result.modified_count != 1:
            continue  # someone traded between our read and write — requote

        await db()[POSITIONS].update_one(
            {"user_id": user["id"], "token_address": address},
            {"$inc": {"balance": delta_balance, "cost_basis": delta_cost, "realized_pnl": realized},
             "$setOnInsert": {"first_trade_at": utcnow(), "handle": user["handle"]}},
            upsert=True,
        )

        trade = {
            "id": S.new_id(),
            "token_address": address,
            "ticker": doc["ticker"],
            "user_id": user["id"],
            "handle": user["handle"],
            "nickname": user.get("nickname"),
            "side": side,
            "base": q.get("base_out") or q.get("base_in") or 0.0,
            "quote": quote_moved,
            "price": q["avg_price"],
            "creator_fee": q["creator_fee"],
            "protocol_fee": q["protocol_fee"],
            "tx_hash": S.fake_tx_hash(address, user["id"], side, amount),
            "ts": utcnow(),
            "graduated": graduates,
        }
        await db()[TRADES].insert_one(dict(trade))
        trade.pop("_id", None)

        fresh = await db()[TOKENS].find_one({"address": address}, {"_id": 0})
        stats = await _token_stats([address])
        projected = S.project_token(fresh, stats=stats.get(address, {}))
        trade["token"] = projected

        await broadcast({"type": "trade", "trade": trade, "token": projected}, address)
        if graduates:
            await broadcast(
                {"type": "graduation", "token": projected,
                 "plan": C.graduation_plan(S.params_for(fresh), fresh["base_sold"])},
                address,
            )
        return trade

    raise HTTPException(409, "A fogueira está muito movimentada. Tente de novo.")


@router.post("/tokens/{address}/trade", response_model=TradeOut)
async def trade(address: str, payload: TradeIn, user: dict = Depends(current_user)) -> Any:
    doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Não achei esse token por aqui.")

    # Derive the slippage floor from a fresh quote so the caller does not have
    # to compute min_out themselves.
    min_out = payload.min_out
    if min_out is None:
        p = S.params_for(doc)
        sold = float(doc.get("base_sold", 0.0))
        preview = (C.quote_buy(p, sold, payload.amount) if payload.side == "buy"
                   else C.quote_sell(p, sold, payload.amount))
        expected = preview["base_out"] if payload.side == "buy" else preview["quote_out"]
        min_out = expected * (1 - payload.slippage)

    return await _execute_trade(
        doc, user, side=payload.side, amount=payload.amount,
        slippage=payload.slippage, min_out=min_out,
    )


@router.get("/tokens/{address}/trades", response_model=list[TradeOut])
async def token_trades(address: str, limit: int = Query(40, ge=1, le=200),
                       side: Optional[str] = None) -> Any:
    query: dict[str, Any] = {"token_address": address}
    if side in ("buy", "sell"):
        query["side"] = side
    return await db()[TRADES].find(query, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)


@router.get("/tokens/{address}/holders", response_model=list[HolderOut])
async def token_holders(address: str, limit: int = Query(50, ge=1, le=200)) -> Any:
    doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Não achei esse token por aqui.")
    rows = await db()[POSITIONS].find(
        {"token_address": address, "balance": {"$gt": 0}}, {"_id": 0}
    ).sort("balance", -1).limit(limit).to_list(limit)

    total = float(doc.get("base_sold", 0.0)) or 1.0
    created = doc["created_at"]
    if isinstance(created, str):
        created = datetime.fromisoformat(created)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    out = []
    for r in rows:
        user = await db()[USERS].find_one({"id": r["user_id"]}, {"_id": 0}) or {}
        first = r.get("first_trade_at")
        if isinstance(first, str):
            first = datetime.fromisoformat(first)
        if first and first.tzinfo is None:
            first = first.replace(tzinfo=timezone.utc)
        share = r["balance"] / total
        out.append({
            "handle": user.get("handle", "anon"),
            "nickname": user.get("nickname"),
            "address": user.get("address"),
            "balance": r["balance"],
            "share": share,
            "is_creator": r["user_id"] == doc["creator_id"],
            "early": bool(first and (first - created) <= timedelta(seconds=60)),
            "whale": share >= 0.03,
        })
    return out


@router.get("/tokens/{address}/candles")
async def token_candles(address: str, minutes: int = Query(60, ge=5, le=1440)) -> Any:
    """Price series for the chart, bucketed by minute."""
    since = utcnow() - timedelta(minutes=minutes)
    rows = await db()[TRADES].aggregate([
        {"$match": {"token_address": address, "ts": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateTrunc": {"date": "$ts", "unit": "minute"}},
            "open": {"$first": "$price"}, "close": {"$last": "$price"},
            "high": {"$max": "$price"}, "low": {"$min": "$price"},
            "volume": {"$sum": "$quote"}, "trades": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(1500)
    return [{"t": r["_id"], **{k: r[k] for k in ("open", "close", "high", "low", "volume", "trades")}}
            for r in rows]


# --------------------------------------------------------------------------
# social
# --------------------------------------------------------------------------

@router.get("/tokens/{address}/comments", response_model=list[CommentOut])
async def list_comments(address: str, limit: int = Query(50, ge=1, le=200)) -> Any:
    rows = await db()[COMMENTS].find({"token_address": address}, {"_id": 0}) \
        .sort("ts", -1).limit(limit).to_list(limit)
    return list(reversed(rows))


@router.post("/tokens/{address}/comments", response_model=CommentOut, status_code=201)
async def post_comment(address: str, payload: CommentIn, user: dict = Depends(current_user)) -> Any:
    doc = await db()[TOKENS].find_one({"address": address}, {"_id": 0, "creator_id": 1, "base_sold": 1})
    if not doc:
        raise HTTPException(404, "Não achei esse token por aqui.")
    position = await db()[POSITIONS].find_one(
        {"user_id": user["id"], "token_address": address}, {"_id": 0, "balance": 1}
    ) or {"balance": 0.0}
    share = position["balance"] / (float(doc.get("base_sold", 0)) or 1.0)

    comment = {
        "id": S.new_id(), "token_address": address, "user_id": user["id"],
        "handle": user["handle"], "nickname": user.get("nickname"),
        "body": payload.body, "ts": utcnow(),
        "tier": S.holder_tier(share, user["id"] == doc["creator_id"], False),
    }
    await db()[COMMENTS].insert_one(dict(comment))
    comment.pop("_id", None)
    await broadcast({"type": "comment", "comment": comment}, address)
    return comment


@router.post("/tokens/{address}/favorite")
async def toggle_favorite(address: str, user: dict = Depends(current_user)) -> Any:
    favorites = set(user.get("favorites") or [])
    if address in favorites:
        favorites.discard(address)
        active = False
    else:
        favorites.add(address)
        active = True
    await db()[USERS].update_one({"id": user["id"]}, {"$set": {"favorites": list(favorites)}})
    return {"address": address, "favorited": active}


@router.post("/users/{handle}/follow")
async def toggle_follow(handle: str, user: dict = Depends(current_user)) -> Any:
    target = await db()[USERS].find_one({"handle": handle}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Não achei essa pessoa.")
    if target["id"] == user["id"]:
        raise HTTPException(400, "Você já anda consigo mesmo.")

    existing = await db()[FOLLOWS].find_one_and_delete(
        {"follower_id": user["id"], "target_id": target["id"]}
    )
    delta = -1 if existing else 1
    if not existing:
        await db()[FOLLOWS].insert_one(
            {"follower_id": user["id"], "target_id": target["id"], "ts": utcnow()}
        )
    await db()[USERS].update_one({"id": target["id"]}, {"$inc": {"follower_count": delta}})
    fresh = await db()[USERS].find_one({"id": target["id"]}, {"_id": 0, "follower_count": 1})
    return {"handle": handle, "following": not existing,
            "follower_count": max(0, fresh.get("follower_count", 0))}


# --------------------------------------------------------------------------
# profiles & portfolio
# --------------------------------------------------------------------------

async def _positions_for(user_id: str, *, only_open: bool = True) -> list[dict]:
    query: dict[str, Any] = {"user_id": user_id}
    if only_open:
        query["balance"] = {"$gt": 1e-9}
    rows = await db()[POSITIONS].find(query, {"_id": 0}).to_list(500)
    if not rows:
        return []
    tokens = await db()[TOKENS].find(
        {"address": {"$in": [r["token_address"] for r in rows]}}, {"_id": 0}
    ).to_list(500)
    by_address = {t["address"]: t for t in tokens}
    stats = await _token_stats(list(by_address))

    out = []
    for r in rows:
        token = by_address.get(r["token_address"])
        if not token:
            continue
        projected = S.project_token(token, stats=stats.get(token["address"], {}))
        value = r["balance"] * projected["price"]
        cost = r.get("cost_basis", 0.0)
        pnl = value - cost
        out.append({
            "token": projected,
            "balance": r["balance"],
            "value": value,
            "cost_basis": cost,
            "pnl": pnl,
            "pnl_pct": (pnl / cost) if cost > 0 else 0.0,
            "realized_pnl": r.get("realized_pnl", 0.0),
        })
    out.sort(key=lambda p: p["value"], reverse=True)
    return out


async def _user_aggregates(user: dict) -> dict:
    """The numbers the profile header and badges are derived from."""
    user_id = user["id"]
    positions = await _positions_for(user_id, only_open=False)

    invested = sum(p["cost_basis"] for p in positions)
    value = sum(p["value"] for p in positions)
    realized = sum(p.get("realized_pnl", 0.0) for p in positions)
    unrealized = sum(p["pnl"] for p in positions)

    bought = await db()[TRADES].distinct("token_address", {"user_id": user_id, "side": "buy"})
    graduated = await db()[TOKENS].count_documents(
        {"address": {"$in": bought}, "status": "graduated"}
    )

    # "Early" means inside the first 60 seconds — the metric the product is
    # proudest of, so it is computed honestly rather than approximated.
    early = 0
    for address in bought:
        token = await db()[TOKENS].find_one(
            {"address": address, "status": "graduated"}, {"_id": 0, "created_at": 1}
        )
        if not token:
            continue
        first = await db()[TRADES].find_one(
            {"user_id": user_id, "token_address": address, "side": "buy"},
            {"_id": 0, "ts": 1}, sort=[("ts", 1)],
        )
        if not first:
            continue
        created, ts = token["created_at"], first["ts"]
        if isinstance(created, str):
            created = datetime.fromisoformat(created)
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if (ts - created) <= timedelta(seconds=60):
            early += 1

    return {
        "total_invested": invested,
        "portfolio_value": value,
        "pnl_abs": realized + unrealized,
        "pnl_pct": ((realized + unrealized) / invested) if invested > 0 else 0.0,
        "tokens_bought": len(bought),
        "graduates_bought": graduated,
        "early_graduates": early,
        "positions": positions,
    }


async def _rank_of(user_id: str) -> Optional[int]:
    rows = await db()[POSITIONS].aggregate([
        {"$group": {"_id": "$user_id", "realized": {"$sum": "$realized_pnl"}}},
        {"$sort": {"realized": -1}},
        {"$limit": 1000},
    ]).to_list(1000)
    for i, row in enumerate(rows, start=1):
        if row["_id"] == user_id:
            return i
    return None


@router.get("/users/{handle}", response_model=UserProfile)
async def user_profile(handle: str, viewer: Optional[dict] = Depends(current_user_optional)) -> Any:
    user = await db()[USERS].find_one({"handle": handle}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Não achei essa pessoa.")
    agg = await _user_aggregates(user)
    is_self = bool(viewer and viewer["id"] == user["id"])
    reveal = is_self or bool(user.get("show_absolute_pnl"))

    return {
        **public_user(user),
        "badges": S.award_badges(user, agg),
        "tokens_bought": agg["tokens_bought"],
        "early_graduates": agg["early_graduates"],
        "rank": await _rank_of(user["id"]),
        "pnl_pct": agg["pnl_pct"],
        # Privacy is asymmetric by design: traders hide absolute figures unless
        # they opt in; creators expose fees by default (see /creators).
        "total_invested": agg["total_invested"] if reveal else None,
        "pnl_abs": agg["pnl_abs"] if reveal else None,
    }


@router.get("/me/portfolio", response_model=list[PositionOut])
async def my_portfolio(user: dict = Depends(current_user)) -> Any:
    return await _positions_for(user["id"])


@router.get("/me/history", response_model=list[TradeOut])
async def my_history(
    user: dict = Depends(current_user),
    side: Optional[str] = None,
    token: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
) -> Any:
    query: dict[str, Any] = {"user_id": user["id"]}
    if side in ("buy", "sell"):
        query["side"] = side
    if token:
        query["token_address"] = token
    return await db()[TRADES].find(query, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)


@router.get("/me/favorites", response_model=list[TokenOut])
async def my_favorites(user: dict = Depends(current_user)) -> Any:
    addresses = user.get("favorites") or []
    if not addresses:
        return []
    docs = await db()[TOKENS].find({"address": {"$in": addresses}}, {"_id": 0}).to_list(200)
    return await _project_many(docs)


@router.get("/users/{handle}/activity")
async def user_activity(handle: str, limit: int = Query(40, ge=1, le=100)) -> Any:
    user = await db()[USERS].find_one({"handle": handle}, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(404, "Não achei essa pessoa.")
    trades = await db()[TRADES].find({"user_id": user["id"]}, {"_id": 0}) \
        .sort("ts", -1).limit(limit).to_list(limit)
    created = await db()[TOKENS].find({"creator_id": user["id"]}, {"_id": 0}) \
        .sort("created_at", -1).limit(limit).to_list(limit)

    events = [{"kind": "trade", "ts": t["ts"], "data": t} for t in trades]
    events += [{"kind": "created", "ts": t["created_at"],
                "data": {"ticker": t["ticker"], "address": t["address"], "name": t["name"]}}
               for t in created]
    events.sort(key=lambda e: e["ts"], reverse=True)
    return events[:limit]


# --------------------------------------------------------------------------
# creator
# --------------------------------------------------------------------------

async def _creator_stats(user: dict, *, include_claimable: bool = False) -> dict:
    tokens = await db()[TOKENS].find({"creator_id": user["id"]}, {"_id": 0}) \
        .sort("created_at", -1).to_list(300)
    projected = await _project_many(tokens)

    now = utcnow()
    for token, doc in zip(projected, tokens):
        if token["status"] == "live" and S.is_dead(doc, now):
            token["status"] = "dead"

    addresses = [t["address"] for t in projected]
    graduated = sum(1 for t in projected if t["status"] == "graduated")
    total = len(projected)
    rate = (graduated / total) if total else 0.0

    volume_rows = await db()[TRADES].aggregate([
        {"$match": {"token_address": {"$in": addresses}}},
        {"$group": {"_id": None, "volume": {"$sum": "$quote"},
                    "fees": {"$sum": "$creator_fee"}}},
    ]).to_list(1)
    total_volume = volume_rows[0]["volume"] if volume_rows else 0.0
    fees_lifetime = volume_rows[0]["fees"] if volume_rows else 0.0

    since_30d = now - timedelta(days=30)
    since_today = now - timedelta(days=1)
    windows = await db()[TRADES].aggregate([
        {"$match": {"token_address": {"$in": addresses}, "ts": {"$gte": since_30d}}},
        {"$group": {
            "_id": {"$dateTrunc": {"date": "$ts", "unit": "day"}},
            "fees": {"$sum": "$creator_fee"}, "volume": {"$sum": "$quote"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(60)
    fees_30d = sum(w["fees"] for w in windows)
    fees_today = sum(w["fees"] for w in windows
                     if w["_id"].replace(tzinfo=timezone.utc) >= since_today)

    holders = await db()[POSITIONS].distinct(
        "user_id", {"token_address": {"$in": addresses}, "balance": {"$gt": 0}}
    )

    score = S.level_score(total_volume, rate, user.get("follower_count", 0))
    nxt, _ = S.next_level_for(score)
    best = max(projected, key=lambda t: t["creator_fees"], default=None)

    stats = {
        "handle": user["handle"],
        "nickname": user.get("nickname") or user["handle"],
        "avatar_url": user.get("avatar_url"),
        "banner_url": user.get("banner_url"),
        "bio": user.get("bio"),
        "verified_creator": bool(user.get("verified_creator")),
        "follower_count": user.get("follower_count", 0),
        "level": S.level_for(score),
        "level_score": score,
        "next_level": nxt,
        "next_level_need": S.next_level_hint(score, total_volume, total, graduated),
        "tokens_created": total,
        "tokens_graduated": graduated,
        "graduation_rate": rate,
        "total_volume": total_volume,
        "unique_holders": len(holders),
        "fees_lifetime": fees_lifetime,
        "fees_30d": fees_30d,
        "fees_today": fees_today,
        "best_token": best,
        "tokens": projected,
        "fees_series": [{"t": w["_id"], "fees": w["fees"], "volume": w["volume"]} for w in windows],
    }
    if include_claimable:
        stats["fees_claimable"] = max(0.0, fees_lifetime - user.get("fees_claimed", 0.0))
    return stats


@router.get("/creators/{handle}", response_model=CreatorStats)
async def creator_profile(handle: str) -> Any:
    user = await db()[USERS].find_one({"handle": handle}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Não achei esse criador.")
    return await _creator_stats(user)


@router.get("/me/creator", response_model=CreatorStats)
async def my_creator_dashboard(user: dict = Depends(current_user)) -> Any:
    return await _creator_stats(user, include_claimable=True)


@router.post("/me/creator/claim")
async def claim_fees(user: dict = Depends(current_user)) -> Any:
    stats = await _creator_stats(user, include_claimable=True)
    claimable = stats["fees_claimable"]
    if claimable <= 0:
        raise HTTPException(400, "Nada de lenha para pegar ainda.")
    await db()[USERS].update_one({"id": user["id"]}, {"$inc": {"fees_claimed": claimable}})
    return {"claimed": claimable, "tx_hash": S.fake_tx_hash("claim", user["id"], claimable)}


# --------------------------------------------------------------------------
# ambient
# --------------------------------------------------------------------------

@router.get("/stats", response_model=PlatformStats)
async def platform_stats() -> Any:
    since = utcnow() - timedelta(hours=24)
    rows = await db()[TRADES].aggregate([
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": None, "volume": {"$sum": "$quote"}, "n": {"$sum": 1}}},
    ]).to_list(1)
    return {
        "tokens_total": await db()[TOKENS].count_documents({}),
        "tokens_live": await db()[TOKENS].count_documents({"status": "live"}),
        "tokens_graduated": await db()[TOKENS].count_documents({"status": "graduated"}),
        "volume_24h": rows[0]["volume"] if rows else 0.0,
        "trades_24h": rows[0]["n"] if rows else 0,
        "traders": len(await db()[TRADES].distinct("user_id", {"ts": {"$gte": since}})),
        "chain_id": 4663,
    }


@router.get("/feed", response_model=list[TradeOut])
async def global_feed(limit: int = Query(30, ge=1, le=100)) -> Any:
    return await db()[TRADES].find({}, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)


@router.get("/leaderboard")
async def leaderboard(window: str = Query("week"), limit: int = Query(25, ge=1, le=100)) -> Any:
    days = {"day": 1, "week": 7, "all": 3650}.get(window, 7)
    since = utcnow() - timedelta(days=days)
    rows = await db()[TRADES].aggregate([
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": "$user_id", "volume": {"$sum": "$quote"}, "trades": {"$sum": 1}}},
        {"$sort": {"volume": -1}},
        {"$limit": limit},
    ]).to_list(limit)

    out = []
    for i, row in enumerate(rows, start=1):
        user = await db()[USERS].find_one({"id": row["_id"]}, {"_id": 0}) or {}
        position_rows = await db()[POSITIONS].aggregate([
            {"$match": {"user_id": row["_id"]}},
            {"$group": {"_id": None, "realized": {"$sum": "$realized_pnl"}}},
        ]).to_list(1)
        out.append({
            "rank": i,
            "handle": user.get("handle", "anon"),
            "nickname": user.get("nickname"),
            "avatar_url": user.get("avatar_url"),
            "volume": row["volume"],
            "trades": row["trades"],
            "realized_pnl": position_rows[0]["realized"] if position_rows else 0.0,
        })
    return out
