"""用户权益计算

对应 TypeScript 版 server/src/utils/user_rights.ts
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models import SystemConfig


def compute_user_rights(params: dict):
    """params: { openId, status, userType, memberLevel, memberExpireAt, trialExpireAt }"""
    now = datetime.now()

    is_wechat_logged_in = bool(params.get("openId"))
    is_banned = params.get("status") == 0

    # 管理员拥有所有权限
    is_admin = params.get("userType") == "admin"
    if is_admin:
        return {
            "isWechatLoggedIn": is_wechat_logged_in,
            "isPaidMember": True,
            "memberLevel": 2,
            "isTrialActive": False,
            "trialExpireAt": None,
            "canUseFeature": not is_banned,
            "isBanned": is_banned,
        }

    member_level = params.get("memberLevel") or 0
    member_expire_at = params.get("memberExpireAt")
    trial_expire_at = params.get("trialExpireAt")

    is_paid_member = (
        member_level > 0
        and member_expire_at is not None
        and member_expire_at.timestamp() > now.timestamp()
    )
    is_trial_active = trial_expire_at is not None and trial_expire_at.timestamp() > now.timestamp()
    can_use_feature = not is_banned and (is_paid_member or is_trial_active)

    return {
        "isWechatLoggedIn": is_wechat_logged_in,
        "isPaidMember": is_paid_member,
        "memberLevel": member_level if is_paid_member else 0,
        "isTrialActive": is_trial_active,
        "trialExpireAt": trial_expire_at,
        "canUseFeature": can_use_feature,
        "isBanned": is_banned,
    }


def get_default_trial_days(db: Session) -> int:
    cfg = db.query(SystemConfig).filter(SystemConfig.key == "default_trial_days").first()
    if not cfg:
        return 7
    try:
        n = int(cfg.value)
        return n if n > 0 else 7
    except (TypeError, ValueError):
        return 7
