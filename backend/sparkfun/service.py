"""Business logic for spark.fun: identity, curve projection, levels, badges.

Everything here is pure or takes plain dicts, so it is testable without a
database. Persistence lives in routes.py.
"""

from __future__ import annotations

import math
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from . import curve as C

# --------------------------------------------------------------------------
# identity
# --------------------------------------------------------------------------

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return secrets.token_hex(12)


def handle_from(address: Optional[str], email: Optional[str], taken: set[str]) -> str:
    """Pick a stable, readable handle and de-duplicate it."""
    if email:
        stem = email.split("@")[0].lower()
    elif address:
        stem = f"sparky{address[-6:].lower()}"
    else:
        stem = f"sparky{secrets.token_hex(3)}"
    stem = "".join(ch for ch in stem if ch.isalnum() or ch == "_")[:16] or "sparky"
    if len(stem) < 3:
        stem = f"{stem}fun"
    candidate = stem
    n = 2
    while candidate in taken:
        candidate = f"{stem}{n}"
        n += 1
    return candidate


def siwe_message(address: str, nonce: str) -> str:
    """The text the wallet signs. Binds address, chain and nonce."""
    return (
        "spark.fun quer entrar na casa com a sua carteira.\n\n"
        f"Endereço: {address}\n"
        f"Rede: Robinhood Chain (4663)\n"
        f"Nonce: {nonce}\n\n"
        "Assinar não custa gas e não autoriza nenhuma transação."
    )


def verify_signature(address: str, message: str, signature: str) -> bool:
    """Recover the signer and compare. Returns False when eth-account is
    unavailable so the caller can decide how to degrade."""
    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
    except ImportError:  # pragma: no cover - depends on deploy image
        return False
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
        return recovered.lower() == address.lower()
    except Exception:
        return False


# --------------------------------------------------------------------------
# curve projection
# --------------------------------------------------------------------------

def params_for(token: dict[str, Any]) -> C.CurveParams:
    return C.curve_params(pair=token.get("pair", "ETH"), mayhem=bool(token.get("mayhem")))


def _int(value: Any, default: int = 0) -> int:
    """Curve amounts are stored as decimal strings so uint256 survives Mongo."""
    if value is None:
        return default
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return default


def project_token(token: dict[str, Any], *, creator: Optional[dict] = None,
                  stats: Optional[dict] = None) -> dict[str, Any]:
    """Turn a stored token document into the shape the UI renders."""
    p = params_for(token)
    sold = _int(token.get("base_sold"))
    raised = _int(token.get("quote_raised"))
    stats = stats or {}
    unit = 10 ** p.decimals

    return {
        "address": token["address"],
        "ticker": token["ticker"],
        "name": token["name"],
        "description": token.get("description", ""),
        "image_url": token.get("image_url"),
        "banner_url": token.get("banner_url"),
        "media_type": token.get("media_type", "image"),
        "links": token.get("links") or {},
        "pair": token.get("pair", "ETH"),
        "mayhem": bool(token.get("mayhem")),
        "status": token.get("status", "live"),
        "creator_id": token.get("creator_id", ""),
        "creator_handle": token.get("creator_handle", ""),
        "creator_nickname": (creator or {}).get("nickname"),
        "created_at": token.get("created_at"),
        "graduated_at": token.get("graduated_at"),
        "last_trade_at": token.get("last_trade_at"),
        "curve": token.get("curve"),
        "base_sold": sold / 10**18,
        "base_sold_raw": str(sold),
        "quote_raised_raw": str(raised),
        "price": C.spot_price(p, sold, raised),
        "market_cap": C.market_cap(p, sold, raised),
        "progress": C.progress(p, raised),
        "raised": raised / unit,
        "to_graduate": C.quote_to_graduate(p, raised) / unit,
        "volume_24h": stats.get("volume_24h", token.get("volume_24h", 0.0)),
        "change_24h": stats.get("change_24h"),
        "holders": stats.get("holders", token.get("holders", 0)),
        "trades": stats.get("trades", token.get("trades", 0)),
        "creator_fees": token.get("creator_fees", 0.0),
        "pool_address": token.get("pool_address"),
        "liquidity_locked": bool(token.get("pool_address")),
    }


def is_dead(token: dict[str, Any], now: Optional[datetime] = None) -> bool:
    """A token is a 'brasa' when nothing has happened for a week and the curve
    never really caught. Dead tokens stay visible — see design/07."""
    if token.get("status") == "graduated":
        return False
    now = now or utcnow()
    last = token.get("last_trade_at") or token.get("created_at")
    if isinstance(last, str):
        last = datetime.fromisoformat(last)
    if last is None:
        return False
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    quiet = now - last > timedelta(days=7)
    barely_lit = C.progress(params_for(token), _int(token.get("quote_raised"))) < 0.05
    return quiet and barely_lit


# --------------------------------------------------------------------------
# creator levels — the formula is public on purpose (design/07 § 4)
# --------------------------------------------------------------------------

# Bands are calibrated against the score formula below, not picked round.
# A solo creator with $5K volume scores ~1.7; $250K with a 20% graduation rate
# and 40 followers scores ~2.8; $4M/38%/1.3K scores ~3.7; $80M/60%/20K scores
# ~4.6. The log terms compress hard, so the usable range is roughly 1.5-5.0.
LEVELS = [
    ("bronze", 0.0), ("silver", 2.6), ("gold", 3.2), ("platinum", 3.8), ("diamond", 4.4),
]
LEVEL_LABEL = {
    "bronze": "Bronze", "silver": "Silver", "gold": "Gold",
    "platinum": "Platinum", "diamond": "Diamond",
}


def level_score(volume_usd: float, graduation_rate: float, followers: int) -> float:
    return (
        0.45 * math.log10(max(volume_usd, 1.0))
        + 0.35 * max(0.0, min(1.0, graduation_rate))
        + 0.20 * math.log10(max(followers, 0) + 1.0)
    )


def level_for(score: float) -> str:
    name = "bronze"
    for level, floor in LEVELS:
        if score >= floor:
            name = level
    return name


def next_level_for(score: float) -> tuple[Optional[str], Optional[float]]:
    for level, floor in LEVELS:
        if score < floor:
            return level, floor
    return None, None


def next_level_hint(score: float, volume_usd: float, tokens: int, graduated: int) -> Optional[str]:
    """Concrete language, not a bare number: 'faltam $180K de volume ou 2 graduações'."""
    nxt, floor = next_level_for(score)
    if nxt is None or floor is None:
        return None
    gap = floor - score
    # Volume alone: 0.45 * log10(v2/v1) = gap
    volume_needed = max(volume_usd, 1.0) * (10 ** (gap / 0.45)) - max(volume_usd, 1.0)
    total = max(tokens, 1)
    rate = graduated / total
    grads_needed = None
    for extra in range(1, 6):
        new_rate = (graduated + extra) / (total + extra)
        if 0.35 * (new_rate - rate) >= gap:
            grads_needed = extra
            break
    parts = [f"${_compact(volume_needed)} de volume"]
    if grads_needed:
        parts.append(f"{grads_needed} graduaç{'ão' if grads_needed == 1 else 'ões'}")
    return f"Faltam {' ou '.join(parts)} para {LEVEL_LABEL[nxt]}"


def _compact(n: float) -> str:
    for unit, size in (("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if abs(n) >= size:
            return f"{n / size:.1f}".rstrip("0").rstrip(".") + unit
    return f"{n:.0f}"


# --------------------------------------------------------------------------
# badges
# --------------------------------------------------------------------------

BADGES = {
    "early_adopter":  {"label": "Early Adopter",  "icon": "sprout"},
    "top_trader_day": {"label": "Top Trader do Dia", "icon": "trophy"},
    "top_trader_week":{"label": "Top Trader da Semana", "icon": "crown"},
    "mayhem_survivor":{"label": "Mayhem Survivor", "icon": "flame"},
    "sniper":         {"label": "Sniper", "icon": "target"},
    "diamond_hands":  {"label": "Diamond Hands", "icon": "gem"},
    "full_hearth":    {"label": "Fogueira Cheia", "icon": "log"},
    "host":           {"label": "Anfitrião", "icon": "home"},
    "patient":        {"label": "Paciente", "icon": "cup"},
}


def award_badges(user: dict, agg: dict) -> list[str]:
    """Derive badges from aggregates. Pure, so it can run on every read."""
    out: list[str] = []
    if user.get("signup_index", 10**9) < 10_000:
        out.append("early_adopter")
    if agg.get("mayhem_wins", 0) >= 3:
        out.append("mayhem_survivor")
    if agg.get("early_graduates", 0) >= 5:
        out.append("sniper")
    if agg.get("longest_hold_days", 0) >= 30:
        out.append("diamond_hands")
    if agg.get("graduates_bought", 0) >= 10:
        out.append("full_hearth")
    if agg.get("streak_days", 0) >= 100:
        out.append("host")
    if agg.get("rank_day") == 1:
        out.append("top_trader_day")
    if agg.get("rank_week") == 1:
        out.append("top_trader_week")
    return out


# --------------------------------------------------------------------------
# holder tiers — used by the chat and the holders list
# --------------------------------------------------------------------------

def holder_tier(share: float, is_creator: bool, early: bool) -> str:
    if is_creator:
        return "creator"
    if share >= 0.03:
        return "whale"
    if early:
        return "early"
    return "holder"
