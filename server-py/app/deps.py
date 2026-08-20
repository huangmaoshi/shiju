"""FastAPI 依赖：鉴权 / 管理员 / 会员权益 / 限流

对应 TypeScript 版 middlewares（auth_middleware / admin_middleware / feature_middleware / rate_limit_middleware）
"""
from typing import Dict, Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .config import config
from .database import get_db
from .models import User
from .utils import jwt as jwt_util
from .utils.user_rights import compute_user_rights


class BusinessError(Exception):
    """业务错误：带 code 与 HTTP status"""

    def __init__(self, code: int, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class AuthContext:
    """当前请求的用户上下文（替代 TS 的 AuthRequest 扩展字段）"""

    def __init__(self, user_id: Optional[int] = None, open_id: Optional[str] = None):
        self.user_id = user_id
        self.open_id = open_id


def extract_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:].strip()
    return None


def _verify_token(token: str) -> Dict:
    return jwt_util.verify(token, config.jwt_secret)


def get_optional_user_id(authorization: Optional[str] = Header(default=None)) -> Optional[int]:
    """authOptional：有 token 则解析 userId，无 token 或无效返回 None"""
    token = extract_token(authorization)
    if not token:
        return None
    try:
        payload = _verify_token(token)
        uid = payload.get("userId")
        return int(uid) if uid is not None else None
    except Exception:
        return None


def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> int:
    """authRequired：必须有效 token，否则 401"""
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = _verify_token(token)
        uid = payload.get("userId")
        if uid is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return int(uid)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_admin(
    x_admin_key: Optional[str] = Header(default=None, alias="x-admin-key"),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> None:
    """adminRequired：x-admin-key 密钥 或 管理员用户 JWT"""
    # 模式1：x-admin-key 密钥鉴权
    if x_admin_key and config.admin_key and x_admin_key == config.admin_key:
        return

    # 模式2：管理员用户 JWT 鉴权
    token = extract_token(authorization)
    if token:
        try:
            payload = _verify_token(token)
            user_id = int(payload.get("userId") or 0)
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user and user.userType == "admin" and user.status == 1:
                    return
        except Exception:
            pass

    raise HTTPException(status_code=403, detail="Forbidden")


def _load_user_with_rights(db: Session, user_id: int) -> Dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    rights = compute_user_rights(
        {
            "openId": user.openId,
            "status": user.status,
            "userType": user.userType,
            "memberLevel": user.memberLevel,
            "memberExpireAt": user.memberExpireAt,
            "trialExpireAt": user.trialExpireAt,
        }
    )
    return {"user": user, "rights": rights}


def require_feature(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Dict:
    """featureRequired：会员或试用中才可用"""
    user_id = get_current_user_id(authorization)
    ctx = _load_user_with_rights(db, user_id)
    rights = ctx["rights"]
    if rights["isBanned"]:
        raise HTTPException(status_code=403, detail="账号已被封禁")
    if not rights["canUseFeature"]:
        raise HTTPException(status_code=402, detail="试用已结束，请开通会员后继续使用")
    return ctx


def require_member(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Dict:
    """memberRequired：付费会员才可用"""
    user_id = get_current_user_id(authorization)
    ctx = _load_user_with_rights(db, user_id)
    if not ctx["rights"]["isPaidMember"]:
        raise HTTPException(status_code=402, detail="该功能需要付费会员")
    return ctx


class RateLimiter:
    """简易内存限流（对应 express-rate-limit）"""

    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, list] = {}

    def check(self, key: str) -> None:
        import time

        now = time.time()
        window_start = now - self.window_seconds
        hits = [t for t in self._hits.get(key, []) if t > window_start]
        if len(hits) >= self.max_requests:
            raise HTTPException(status_code=429, detail="Too many requests, please try again later.")
        hits.append(now)
        self._hits[key] = hits


general_limiter = RateLimiter(100, 60)
login_limiter = RateLimiter(20, 60)


def check_general_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    general_limiter.check(key)


def check_login_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    login_limiter.check(key)
