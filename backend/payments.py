"""USDT multi-chain payment verification (TRC-20, ERC-20, BEP-20, TON)."""
import base64
from datetime import datetime, timedelta

import requests as _http
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import PaymentRequest, User

# ── Config ────────────────────────────────────────────────────────────────────
USDT_AMOUNT = 30.0
SUB_DAYS    = 30

WALLETS = {
    "trc20": {"wallet": "TPEFyL2jj6hDcD7mvnwGgAgvUNrZWbKtVb", "label": "TRC-20 · Tron"},
    "erc20": {"wallet": "0x5ae6964d7a56af2fce31bf0c9c712e19e4cd45f7", "label": "ERC-20 · Ethereum"},
    "bep20": {"wallet": "0x5ae6964d7a56af2fce31bf0c9c712e19e4cd45f7", "label": "BEP-20 · BSC"},
    "ton":   {"wallet": "UQBX_GM_yo6EQOrhtqeJn71JaWR7ksitwTCEAkb8c7eLw1yO", "label": "TON · Jetton"},
}

# Contract / token addresses
_USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
_USDT_ERC20 = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
_USDT_BEP20 = "0x55d398326f99059fF775485246999027B3197955"
_USDT_TON   = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"

_ETH_RPC = "https://eth.llamarpc.com"
_BSC_RPC = "https://bsc.publicnode.com"

_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


# ── Address helpers ───────────────────────────────────────────────────────────

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58decode(s: str) -> bytes:
    n = 0
    for c in s:
        n = n * 58 + _B58.index(c)
    length = (n.bit_length() + 7) // 8 or 1
    raw = n.to_bytes(length, "big")
    pad = sum(1 for c in s if c == "1")
    return b"\x00" * pad + raw


def _tron_hex(addr: str) -> str:
    raw = _b58decode(addr)
    return raw[1:21].hex()


def _norm_to_hex(h: str) -> str:
    h = h.lower().lstrip("0x")
    if len(h) == 42 and h.startswith("41"):
        return h[2:]
    return h[-40:]


def _ton_to_raw(addr: str) -> str:
    """Convert TON friendly address (EQ.../UQ...) to 'workchain:hex' form."""
    if ":" in addr:
        return addr.lower()
    s = addr.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    raw = base64.b64decode(s)
    workchain = raw[1] if raw[1] < 128 else raw[1] - 256
    return f"{workchain}:{raw[2:34].hex()}"


# ── Verifiers ─────────────────────────────────────────────────────────────────

def _verify_trc20(tx_hash: str) -> float:
    wallet_hex   = _tron_hex(WALLETS["trc20"]["wallet"])
    contract_hex = _tron_hex(_USDT_TRC20)
    try:
        resp = _http.get(f"https://api.trongrid.io/v1/transactions/{tx_hash}/events", timeout=12)
    except Exception:
        raise HTTPException(502, "Не удалось связаться с Tron API")
    if resp.status_code == 404:
        raise HTTPException(400, "Транзакция не найдена. Дождитесь подтверждения в сети Tron.")
    if resp.status_code != 200:
        raise HTTPException(400, f"Ошибка Tron API: {resp.status_code}")
    for event in resp.json().get("data", []):
        if event.get("event_name") != "Transfer":
            continue
        if _norm_to_hex(event.get("contract_address", "")) != contract_hex:
            continue
        result = event.get("result", {})
        if _norm_to_hex(result.get("to", "")) != wallet_hex:
            continue
        try:
            return int(result.get("value", "0")) / 1_000_000
        except (ValueError, TypeError):
            continue
    raise HTTPException(400, "Перевод USDT TRC-20 на указанный кошелёк не найден в транзакции.")


def _verify_evm(tx_hash: str, network: str) -> float:
    rpc      = _ETH_RPC if network == "erc20" else _BSC_RPC
    contract = _USDT_ERC20 if network == "erc20" else _USDT_BEP20
    decimals = 6 if network == "erc20" else 18
    wallet   = WALLETS[network]["wallet"].lower()
    label    = "Ethereum" if network == "erc20" else "BSC"
    try:
        resp = _http.post(rpc, json={
            "jsonrpc": "2.0", "method": "eth_getTransactionReceipt",
            "params": [tx_hash], "id": 1,
        }, timeout=12)
        result = resp.json().get("result")
    except Exception:
        raise HTTPException(502, f"Не удалось связаться с {label} RPC")
    if not result:
        raise HTTPException(400, f"Транзакция не найдена в сети {label}. Дождитесь подтверждения.")
    if result.get("status") == "0x0":
        raise HTTPException(400, "Транзакция завершилась с ошибкой в сети.")
    wallet_padded = wallet.lstrip("0x").lower().zfill(64)
    for log in result.get("logs", []):
        if log.get("address", "").lower() != contract.lower():
            continue
        topics = log.get("topics", [])
        if not topics or topics[0].lower() != _TRANSFER_TOPIC:
            continue
        if len(topics) < 3:
            continue
        if topics[2].lower().lstrip("0x").zfill(64) != wallet_padded:
            continue
        try:
            return int(log.get("data", "0x0"), 16) / (10 ** decimals)
        except (ValueError, TypeError):
            continue
    raise HTTPException(400, f"Перевод USDT на указанный {label}-кошелёк не найден в транзакции.")


def _verify_ton(tx_hash: str) -> float:
    """Verify TON USDT Jetton transfer via tonapi.io events endpoint."""
    wallet_raw = _ton_to_raw(WALLETS["ton"]["wallet"])
    jetton_raw = _ton_to_raw(_USDT_TON)
    try:
        resp = _http.get(
            f"https://tonapi.io/v2/events/{tx_hash}",
            timeout=12,
            headers={"Accept": "application/json"},
        )
    except Exception:
        raise HTTPException(502, "Не удалось связаться с TON API")
    if resp.status_code == 404:
        raise HTTPException(400, "Транзакция не найдена в сети TON. Дождитесь подтверждения.")
    if resp.status_code != 200:
        raise HTTPException(400, f"Ошибка TON API: {resp.status_code}")
    for action in resp.json().get("actions", []):
        if action.get("type") != "JettonTransfer" or action.get("status") != "ok":
            continue
        jt = action.get("JettonTransfer", {})
        jetton_addr = _ton_to_raw(jt.get("jetton", {}).get("address", ""))
        if jetton_addr != jetton_raw:
            continue
        recipient = jt.get("recipient", {}).get("address", "")
        if _ton_to_raw(recipient) != wallet_raw:
            continue
        try:
            return int(jt.get("amount", "0")) / 1_000_000
        except (ValueError, TypeError):
            continue
    raise HTTPException(400, "Перевод USDT TON Jetton на указанный кошелёк не найден в транзакции.")


_VERIFIERS = {
    "trc20": _verify_trc20,
    "erc20": lambda h: _verify_evm(h, "erc20"),
    "bep20": lambda h: _verify_evm(h, "bep20"),
    "ton":   _verify_ton,
}


# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/subscription", tags=["subscription"])


@router.get("/wallet")
def get_wallet_info():
    return {
        "amount":   USDT_AMOUNT,
        "days":     SUB_DAYS,
        "networks": {
            key: {"wallet": v["wallet"], "label": v["label"]}
            for key, v in WALLETS.items()
        },
    }


class PayRequest(BaseModel):
    tx_hash: str
    network: str = "trc20"


@router.post("/pay")
def submit_payment(
    data: PayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = data.tx_hash.strip()
    network = data.network.strip().lower()

    if not tx:
        raise HTTPException(400, "Укажите хэш транзакции")
    if network not in _VERIFIERS:
        raise HTTPException(400, f"Неизвестная сеть: {network}")

    existing = db.query(PaymentRequest).filter(PaymentRequest.tx_hash == tx).first()
    if existing:
        if existing.status == "confirmed":
            raise HTTPException(409, "Эта транзакция уже была использована для активации подписки")
        raise HTTPException(409, "Эта транзакция уже была отправлена на проверку")

    amount = _VERIFIERS[network](tx)

    if amount < USDT_AMOUNT:
        pr = PaymentRequest(user_id=current_user.id, tx_hash=tx, network=network,
                            status="failed", amount_usdt=amount,
                            error=f"Сумма {amount:.2f} < {USDT_AMOUNT} USDT")
        db.add(pr)
        db.commit()
        raise HTTPException(400, f"Сумма платежа {amount:.2f} USDT меньше требуемых {USDT_AMOUNT} USDT")

    pr = PaymentRequest(user_id=current_user.id, tx_hash=tx, network=network,
                        status="confirmed", amount_usdt=amount)
    db.add(pr)

    now  = datetime.utcnow()
    base = current_user.subscription_expires_at
    if current_user.subscription == "pro" and base and base > now:
        current_user.subscription_expires_at = base + timedelta(days=SUB_DAYS)
    else:
        current_user.subscription = "pro"
        current_user.subscription_expires_at = now + timedelta(days=SUB_DAYS)

    db.commit()
    db.refresh(current_user)

    return {
        "status": "confirmed",
        "amount_usdt": amount,
        "network": network,
        "subscription_expires_at": current_user.subscription_expires_at,
    }

from datetime import datetime, timedelta

import requests as _http
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import PaymentRequest, User

# ── Config (edit these) ───────────────────────────────────────────────────────
WALLET_ADDRESS = "TPEFyL2jj6hDcD7mvnwGgAgvUNrZWbKtVb"
USDT_CONTRACT  = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"  # USDT TRC-20
USDT_AMOUNT    = 30.0    # минимальная сумма в USDT
USDT_DECIMALS  = 6
SUB_DAYS       = 30      # дней подписки за один платёж

# ── Helpers ───────────────────────────────────────────────────────────────────
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58decode(s: str) -> bytes:
    n = 0
    for c in s:
        n = n * 58 + _B58.index(c)
    length = (n.bit_length() + 7) // 8 or 1
    raw = n.to_bytes(length, "big")
    pad = sum(1 for c in s if c == "1")
    return b"\x00" * pad + raw


def _tron_hex(addr: str) -> str:
    """Base58check Tron address → lowercase 20-byte hex (no prefix, no checksum)."""
    raw = _b58decode(addr)  # 25 bytes: 0x41 + 20 addr bytes + 4 checksum bytes
    return raw[1:21].hex()


def _norm_to_hex(h: str) -> str:
    """Normalise TronGrid event address → lowercase 20-byte hex."""
    h = h.lower().lstrip("0x")
    if len(h) == 42 and h.startswith("41"):
        return h[2:]
    return h[-40:]  # fallback: last 40 hex chars


def _verify_trc20(tx_hash: str) -> float:
    """Verify TRC-20 USDT payment. Returns amount in USDT on success, raises HTTPException otherwise."""
    try:
        resp = _http.get(
            f"https://api.trongrid.io/v1/transactions/{tx_hash}/events",
            timeout=12,
        )
    except Exception:
        raise HTTPException(502, "Не удалось связаться с Tron API. Попробуйте позже.")

    if resp.status_code == 404:
        raise HTTPException(400, "Транзакция не найдена. Проверьте хэш и дождитесь подтверждения в сети.")
    if resp.status_code != 200:
        raise HTTPException(400, f"Ошибка Tron API: {resp.status_code}")

    wallet_hex   = _tron_hex(WALLET_ADDRESS)
    contract_hex = _tron_hex(USDT_CONTRACT)

    for event in resp.json().get("data", []):
        if event.get("event_name") != "Transfer":
            continue
        if _norm_to_hex(event.get("contract_address", "")) != contract_hex:
            continue
        result = event.get("result", {})
        if _norm_to_hex(result.get("to", "")) != wallet_hex:
            continue
        try:
            amount = int(result.get("value", "0")) / (10 ** USDT_DECIMALS)
        except (ValueError, TypeError):
            continue
        return amount

    raise HTTPException(
        400,
        "Платёж не найден: транзакция не содержит перевод USDT на указанный кошелёк. "
        "Убедитесь, что используете сеть TRC-20 и правильный адрес.",
    )



