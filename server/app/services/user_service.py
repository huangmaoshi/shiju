"""用户服务（对应 TS user_service.ts）"""
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import Member, User


def _toUserInfo(user: User, member: Member | None) -> dict:
    return {
        "id": str(user.id),
        "openId": user.openId,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "isMember": bool(member and member.expireDate and member.expireDate > datetime.now()),
        "memberExpireDate": member.expireDate.isoformat() if member and member.expireDate else None,
    }


def upsertByOpenId(db: Session, openId: str) -> dict:
    now = datetime.now()
    user = db.query(User).filter(User.openId == openId).first()
    if user:
        user.lastLoginAt = now
        user.updatedAt = now
        db.commit()
    else:
        user = User(openId=openId, lastLoginAt=now)
        db.add(user)
        db.commit()
        db.refresh(user)

    member = db.query(Member).filter(Member.userId == user.id).first()
    return _toUserInfo(user, member)


def getUserInfo(db: Session, userId: int) -> dict | None:
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        return None
    member = db.query(Member).filter(Member.userId == userId).first()
    return _toUserInfo(user, member)
