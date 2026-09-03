"""Pydantic schemas for the spark.fun API."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

TICKER_RE = re.compile(r"^[A-Z0-9]{2,10}$")
HANDLE_RE = re.compile(r"^[a-z0-9_]{3,20}$")
ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")

Pair = Literal["ETH", "USDC"]
TokenStatus = Literal["live", "graduated", "dead"]
Side = Literal["buy", "sell"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# --------------------------------------------------------------------------
# users
# --------------------------------------------------------------------------

class SocialLinks(Base):
    x: Optional[str] = None
    telegram: Optional[str] = None
    website: Optional[str] = None


class UserPublic(Base):
    id: str
    handle: str
    nickname: str
    address: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_theme: str = "hearth"
    bio: Optional[str] = None
    mood: str = "cozy"
    created_at: datetime
    is_creator: bool = False
    follower_count: int = 0
    verified_creator: bool = False


class UserProfile(UserPublic):
    """Public profile plus the aggregates the profile header renders."""
    badges: list[str] = Field(default_factory=list)
    tokens_bought: int = 0
    early_graduates: int = 0
    rank: Optional[int] = None
    pnl_pct: Optional[float] = None
    # Absolute figures are omitted unless the owner opted in — see
    # design/08-profiles.md: privacy is asymmetric by design.
    total_invested: Optional[float] = None
    pnl_abs: Optional[float] = None


class UserPatch(Base):
    nickname: Optional[str] = None
    bio: Optional[str] = None
    banner_theme: Optional[str] = None
    mood: Optional[str] = None
    avatar_url: Optional[str] = None
    show_absolute_pnl: Optional[bool] = None

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not 1 <= len(v) <= 32:
            raise ValueError("O apelido precisa ter entre 1 e 32 caracteres.")
        return v

    @field_validator("bio")
    @classmethod
    def _bio(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 600:
            raise ValueError("A bio passa de 600 caracteres.")
        return v


class NonceOut(Base):
    address: str
    nonce: str
    message: str


class VerifyIn(Base):
    address: str
    signature: str
    nonce: str


class GuestIn(Base):
    email: str
    nickname: Optional[str] = None


class Session(Base):
    token: str
    user: UserPublic
    signature_verified: bool = True


# --------------------------------------------------------------------------
# tokens
# --------------------------------------------------------------------------

class TokenCreate(Base):
    name: str
    ticker: str
    description: Optional[str] = ""
    image_url: Optional[str] = None
    banner_url: Optional[str] = None
    media_type: Literal["image", "video"] = "image"
    links: SocialLinks = Field(default_factory=SocialLinks)
    pair: Pair = "ETH"
    mayhem: bool = False
    dev_buy: float = 0.0

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 48:
            raise ValueError("O nome precisa ter entre 1 e 48 caracteres.")
        return v

    @field_validator("ticker")
    @classmethod
    def _ticker(cls, v: str) -> str:
        v = v.strip().upper().lstrip("$")
        if not TICKER_RE.match(v):
            raise ValueError("O ticker usa de 2 a 10 letras ou números, sem espaços.")
        return v

    @field_validator("description")
    @classmethod
    def _desc(cls, v: Optional[str]) -> str:
        v = (v or "").strip()
        if len(v) > 500:
            raise ValueError("A descrição passa de 500 caracteres.")
        return v

    @field_validator("dev_buy")
    @classmethod
    def _dev_buy(cls, v: float) -> float:
        if v < 0:
            raise ValueError("A compra inicial não pode ser negativa.")
        return v


class TokenOut(Base):
    address: str
    ticker: str
    name: str
    description: str = ""
    image_url: Optional[str] = None
    banner_url: Optional[str] = None
    media_type: str = "image"
    links: SocialLinks = Field(default_factory=SocialLinks)

    pair: Pair
    mayhem: bool
    status: TokenStatus

    creator_id: str
    creator_handle: str
    creator_nickname: Optional[str] = None

    created_at: datetime
    graduated_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None

    # live curve state
    base_sold: float = 0.0
    price: float = 0.0
    market_cap: float = 0.0
    progress: float = 0.0
    raised: float = 0.0
    to_graduate: float = 0.0

    volume_24h: float = 0.0
    change_24h: Optional[float] = None
    holders: int = 0
    trades: int = 0
    creator_fees: float = 0.0

    pool_address: Optional[str] = None
    liquidity_locked: bool = False


class QuoteIn(Base):
    side: Side
    amount: float

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Informe um valor maior que zero.")
        return v


class TradeIn(QuoteIn):
    # Fraction, e.g. 0.01 = 1%. The panel defaults to 1%.
    slippage: float = 0.01
    min_out: Optional[float] = None

    @field_validator("slippage")
    @classmethod
    def _slip(cls, v: float) -> float:
        if not 0 < v <= 0.5:
            raise ValueError("A margem precisa ficar entre 0 e 50%.")
        return v


class TradeOut(Base):
    id: str
    token_address: str
    ticker: str
    side: Side
    base: float
    quote: float
    price: float
    creator_fee: float
    protocol_fee: float
    tx_hash: str
    ts: datetime
    handle: Optional[str] = None
    nickname: Optional[str] = None
    graduated: bool = False
    token: Optional[TokenOut] = None


class HolderOut(Base):
    handle: str
    nickname: Optional[str] = None
    address: Optional[str] = None
    balance: float
    share: float
    is_creator: bool = False
    early: bool = False
    whale: bool = False


class PositionOut(Base):
    token: TokenOut
    balance: float
    value: float
    cost_basis: float
    pnl: float
    pnl_pct: float


class CommentIn(Base):
    body: str

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 400:
            raise ValueError("A mensagem precisa ter entre 1 e 400 caracteres.")
        return v


class CommentOut(Base):
    id: str
    handle: str
    nickname: Optional[str] = None
    body: str
    ts: datetime
    tier: Optional[str] = None


class CreatorStats(Base):
    handle: str
    nickname: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    bio: Optional[str] = None
    verified_creator: bool = False
    follower_count: int = 0

    level: str = "bronze"
    level_score: float = 0.0
    next_level: Optional[str] = None
    next_level_need: Optional[str] = None

    tokens_created: int = 0
    tokens_graduated: int = 0
    graduation_rate: float = 0.0
    total_volume: float = 0.0
    unique_holders: int = 0

    fees_lifetime: float = 0.0
    fees_30d: float = 0.0
    fees_today: float = 0.0
    fees_claimable: float = 0.0
    best_token: Optional[TokenOut] = None
    tokens: list[TokenOut] = Field(default_factory=list)
    fees_series: list[dict[str, Any]] = Field(default_factory=list)


class PlatformStats(Base):
    tokens_total: int = 0
    tokens_live: int = 0
    tokens_graduated: int = 0
    volume_24h: float = 0.0
    trades_24h: int = 0
    traders: int = 0
    chain_id: int = 4663
