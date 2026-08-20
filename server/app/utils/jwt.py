"""JWT 签发与验证

对应 TypeScript 版 server/src/utils/jwt.ts（jsonwebtoken）
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt

ALGORITHM = "HS256"


def _parse_expires_in(expires_in: str | int) -> timedelta:
    """解析 jsonwebtoken 风格过期时间："2h"/"7d"/"30m"/60 等"""
    if isinstance(expires_in, (int, float)):
        return timedelta(seconds=expires_in)
    text = str(expires_in).strip()
    if not text:
        return timedelta(hours=2)
    unit = text[-1].lower()
    try:
        amount = float(text[:-1])
    except ValueError:
        return timedelta(hours=2)
    if unit == "s":
        return timedelta(seconds=amount)
    if unit == "m":
        return timedelta(minutes=amount)
    if unit == "h":
        return timedelta(hours=amount)
    if unit == "d":
        return timedelta(days=amount)
    return timedelta(hours=amount)


def sign(payload: Dict[str, Any], secret: str, expires_in: str | int = "2h") -> str:
    now = datetime.now(timezone.utc)
    token_payload = dict(payload)
    token_payload["iat"] = now
    token_payload["exp"] = now + _parse_expires_in(expires_in)
    return jwt.encode(token_payload, secret, algorithm=ALGORITHM, headers={"typ": "JWT"})


def verify(token: str, secret: str) -> Dict[str, Any]:
    """验证 JWT，失败抛 jwt.PyJWTError"""
    return jwt.decode(token, secret, algorithms=[ALGORITHM])


def extract_payload_user_id(payload: Dict[str, Any]) -> Optional[str]:
    """从 payload 提取 userId（兼容数字/字符串）"""
    uid = payload.get("userId")
    return str(uid) if uid is not None else None
