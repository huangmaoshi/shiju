"""认证服务

对应 TypeScript 版 server/src/services/auth_service.ts
"""
import re
import time
import random
import string
from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import config
from ..deps import BusinessError
from ..models import User, SyncRecord
from ..utils import jwt as jwt_util
from ..utils.password import hash_password, verify_password
from ..utils.user_rights import compute_user_rights, get_default_trial_days

DEV_OPEN_ID_PREFIX = "dev_openid_"


def _parse_expires_in_to_seconds(expires_in: str | int) -> int:
    if isinstance(expires_in, (int, float)):
        return int(expires_in)
    m = re.match(r"^(\d+)([smhd])$", str(expires_in))
    if not m:
        return 7200
    val = int(m.group(1))
    unit = m.group(2)
    return {"s": val, "m": val * 60, "h": val * 3600, "d": val * 86400}.get(unit, 7200)


def buildUserInfo(user) -> dict:
    userType = user.userType or "wechat"
    rights = compute_user_rights({
        "openId": user.openId,
        "status": user.status,
        "userType": userType,
        "memberLevel": user.memberLevel,
        "memberExpireAt": user.memberExpireAt,
        "trialExpireAt": user.trialExpireAt,
    })
    return {
        "id": str(user.id),
        "openId": user.openId,
        "username": user.username or None,
        "nickname": user.nickname or None,
        "avatar": user.avatar or None,
        "userType": userType,
        "isAdmin": userType == "admin",
        "memberLevel": rights["memberLevel"],
        "isPaidMember": rights["isPaidMember"],
        "isTrialActive": rights["isTrialActive"],
        "trialExpireAt": rights["trialExpireAt"].isoformat() if rights["trialExpireAt"] else None,
        "memberExpireDate": user.memberExpireAt.isoformat() if user.memberExpireAt else None,
        "canUseFeature": rights["canUseFeature"],
        "isBanned": rights["isBanned"],
    }


def _sign_and_return(db: Session, user) -> dict:
    token = jwt_util.sign(
        {"userId": str(user.id), "openId": user.openId},
        config.jwt_secret,
        config.jwt_expires_in,
    )
    expires_in_sec = _parse_expires_in_to_seconds(config.jwt_expires_in)
    return {"token": token, "expiresIn": expires_in_sec, "user": buildUserInfo(user)}


def wechatLogin(db: Session, code: str | None = None) -> dict:
    if config.node_env != "production":
        open_id = f"{DEV_OPEN_ID_PREFIX}{code}" if code else f"{DEV_OPEN_ID_PREFIX}guest"
    else:
        if not code:
            raise BusinessError(400, "微信登录 code 不能为空")
        open_id = code

    user = db.query(User).filter(User.openId == open_id).first()

    if not user:
        trial_days = get_default_trial_days(db)
        trial_expire_at = datetime.now() + timedelta(days=trial_days)
        user = User(
            openId=open_id,
            userType="wechat",
            trialExpireAt=trial_expire_at,
            lastLoginAt=datetime.now(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.lastLoginAt = datetime.now()
        user.updatedAt = datetime.now()
        db.commit()
        db.refresh(user)

    return _sign_and_return(db, user)


def register(db: Session, username: str, password: str, nickname: str | None = None) -> dict:
    if not username or not password:
        raise BusinessError(400, "账号和密码不能为空")
    if len(username) < 3 or len(username) > 32:
        raise BusinessError(400, "账号长度应在 3-32 之间")
    if len(password) < 6 or len(password) > 64:
        raise BusinessError(400, "密码长度应在 6-64 之间")

    existing = db.query(User).filter(
        or_(User.username == username, User.openId == username)
    ).first()
    if existing:
        raise BusinessError(409, "账号已存在")

    trial_days = get_default_trial_days(db)
    trial_expire_at = datetime.now() + timedelta(days=trial_days)
    open_id = f"account_{int(time.time() * 1000)}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"

    user = User(
        openId=open_id,
        username=username,
        passwordHash=hash_password(password),
        nickname=nickname or username,
        userType="account",
        trialExpireAt=trial_expire_at,
        lastLoginAt=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _sign_and_return(db, user)


def login(db: Session, username: str, password: str) -> dict:
    if not username or not password:
        raise BusinessError(400, "账号和密码不能为空")

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.passwordHash:
        raise BusinessError(401, "账号或密码错误", 401)

    if not verify_password(password, user.passwordHash):
        raise BusinessError(401, "账号或密码错误", 401)

    if user.status == 0:
        raise BusinessError(403, "账号已被封禁", 403)

    user.lastLoginAt = datetime.now()
    user.updatedAt = datetime.now()
    db.commit()
    db.refresh(user)

    return _sign_and_return(db, user)


def logout(db: Session, userId: int) -> None:
    uid = int(userId) if userId else 0
    if not uid:
        raise BusinessError(400, "非法的用户 ID")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise BusinessError(404, "用户不存在", 404)

    record = SyncRecord(
        userId=uid,
        tableName="User",
        recordId=uid,
        action="logout",
    )
    db.add(record)
    db.commit()


def refresh(db: Session, token: str) -> dict:
    try:
        payload = jwt_util.verify(token, config.jwt_secret)
    except Exception:
        raise BusinessError(401, "无效或已过期的 token", 401)

    user_id = int(payload.get("userId") or 0)
    if not user_id:
        raise BusinessError(401, "无效的 token 载荷", 401)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BusinessError(404, "用户不存在", 404)

    new_token = jwt_util.sign(
        {"userId": str(user.id), "openId": user.openId},
        config.jwt_secret,
        config.jwt_expires_in,
    )

    return {"token": new_token, "openId": user.openId}
