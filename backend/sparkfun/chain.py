"""JSON-RPC client and event decoding for Robinhood Chain.

Deliberately thin: the backend only ever *reads* the chain. It holds no key,
signs nothing and can move no funds. Everything it stores is derived from
events that already happened.
"""

from __future__ import annotations

import os
from typing import Any, Iterable, Optional

import httpx
from eth_abi import decode as abi_decode
from eth_utils import keccak, to_checksum_address

CHAIN_ID = int(os.environ.get("SPARK_CHAIN_ID", "4663"))
RPC_URL = os.environ.get(
    "SPARK_RPC_URL",
    "https://rpc.testnet.chain.robinhood.com" if CHAIN_ID == 46630
    else "https://rpc.mainnet.chain.robinhood.com",
)
FACTORY_ADDRESS = (os.environ.get("SPARK_FACTORY_ADDRESS") or "").strip()
DEPLOY_BLOCK = int(os.environ.get("SPARK_DEPLOY_BLOCK", "0"))

# Some RPCs cap the span of a single eth_getLogs call.
MAX_BLOCK_SPAN = int(os.environ.get("SPARK_LOG_SPAN", "9000"))


class RpcError(RuntimeError):
    pass


def configured() -> bool:
    return bool(FACTORY_ADDRESS)


def event_topic(signature: str) -> str:
    return "0x" + keccak(text=signature).hex()


# Signatures must match the contracts exactly; a typo here means silently
# indexing nothing, so they are asserted against the ABI in tests.
TOPICS = {
    "TokenLaunched": event_topic(
        "TokenLaunched(address,address,address,string,string,address,bool,string)"
    ),
    "Bought": event_topic("Bought(address,uint256,uint256,uint256,uint256,uint256,uint256)"),
    "Sold": event_topic("Sold(address,uint256,uint256,uint256,uint256,uint256,uint256)"),
    "Graduated": event_topic("Graduated(address,uint256,uint256,uint256,uint160)"),
}
TOPIC_TO_NAME = {v: k for k, v in TOPICS.items()}


class Rpc:
    def __init__(self, url: str = RPC_URL, timeout: float = 20.0) -> None:
        self.url = url
        self._client = httpx.AsyncClient(timeout=timeout)
        self._id = 0

    async def close(self) -> None:
        await self._client.aclose()

    async def call(self, method: str, params: list[Any]) -> Any:
        self._id += 1
        res = await self._client.post(
            self.url, json={"jsonrpc": "2.0", "id": self._id, "method": method, "params": params}
        )
        res.raise_for_status()
        body = res.json()
        if "error" in body:
            raise RpcError(f"{method}: {body['error'].get('message', body['error'])}")
        return body["result"]

    async def chain_id(self) -> int:
        return int(await self.call("eth_chainId", []), 16)

    async def block_number(self) -> int:
        return int(await self.call("eth_blockNumber", []), 16)

    async def get_logs(self, *, address: Optional[str], topics: list, from_block: int, to_block: int) -> list[dict]:
        params: dict[str, Any] = {
            "fromBlock": hex(from_block),
            "toBlock": hex(to_block),
            "topics": topics,
        }
        if address:
            params["address"] = address
        return await self.call("eth_getLogs", [params])

    async def block_timestamp(self, block_number: int) -> int:
        block = await self.call("eth_getBlockByNumber", [hex(block_number), False])
        return int(block["timestamp"], 16)

    async def call_contract(self, to: str, data: str) -> str:
        return await self.call("eth_call", [{"to": to, "data": data}, "latest"])


def _address_from_topic(topic: str) -> str:
    return to_checksum_address("0x" + topic[-40:])


def decode_log(log: dict) -> Optional[dict]:
    """Turns a raw log into a typed event, or None if it is not ours."""
    topics = log.get("topics") or []
    if not topics:
        return None
    name = TOPIC_TO_NAME.get(topics[0])
    if name is None:
        return None

    data = bytes.fromhex(log["data"][2:]) if log.get("data", "0x") != "0x" else b""
    base = {
        "event": name,
        "address": to_checksum_address(log["address"]),
        "block": int(log["blockNumber"], 16),
        "tx_hash": log["transactionHash"],
        "log_index": int(log["logIndex"], 16),
    }

    if name == "TokenLaunched":
        # indexed: token, curve, creator; data: name, symbol, quoteToken, mayhem, metadataURI
        name_, symbol, quote_token, mayhem, metadata_uri = abi_decode(
            ["string", "string", "address", "bool", "string"], data
        )
        return {
            **base,
            "token": _address_from_topic(topics[1]),
            "curve": _address_from_topic(topics[2]),
            "creator": _address_from_topic(topics[3]),
            "name": name_,
            "symbol": symbol,
            "quote_token": to_checksum_address(quote_token),
            "mayhem": mayhem,
            "metadata_uri": metadata_uri,
        }

    if name in ("Bought", "Sold"):
        # The two events do NOT share a field order, and both are six uint256s,
        # so nothing catches a mix-up except reading the signatures:
        #   Bought(buyer,  quoteIn, baseOut, creatorFee, protocolFee, baseSold, quoteRaised)
        #   Sold  (seller, baseIn,  quoteOut, creatorFee, protocolFee, baseSold, quoteRaised)
        # Decoding a sell with the buy order silently swaps the token and quote
        # amounts, which corrupts every position and every volume figure.
        first, second, creator_fee, protocol_fee, base_sold, quote_raised = abi_decode(
            ["uint256"] * 6, data
        )
        quote, base_amount = (first, second) if name == "Bought" else (second, first)
        return {
            **base,
            "side": "buy" if name == "Bought" else "sell",
            "trader": _address_from_topic(topics[1]),
            "quote": quote,
            "base": base_amount,
            "creator_fee": creator_fee,
            "protocol_fee": protocol_fee,
            "base_sold": base_sold,
            "quote_raised": quote_raised,
        }

    if name == "Graduated":
        # indexed: pool; data: tokenId, baseLiquidity, quoteLiquidity, sqrtPriceX96
        token_id, base_liq, quote_liq, sqrt_price = abi_decode(
            ["uint256", "uint256", "uint256", "uint160"], data
        )
        return {
            **base,
            "pool": _address_from_topic(topics[1]),
            "position_token_id": token_id,
            "base_liquidity": base_liq,
            "quote_liquidity": quote_liq,
            "sqrt_price_x96": sqrt_price,
        }

    return None


def chunks(start: int, end: int, span: int = MAX_BLOCK_SPAN) -> Iterable[tuple[int, int]]:
    while start <= end:
        stop = min(start + span - 1, end)
        yield start, stop
        start = stop + 1
