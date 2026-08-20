"""会员服务（对应 TS member_service.ts）"""
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import Member, Order, User
from ..utils.user_rights import compute_user_rights

DEFAULT_PLANS = {
    "monthly": {"name": "月卡", "price": 9.9, "days": 30, "memberLevel": 1},
    "quarterly": {"name": "季卡", "price": 25.0, "days": 90, "memberLevel": 1},
    "yearly": {"name": "包年", "price": 88.0, "days": 365, "memberLevel": 2},
}


def getPlans() -> dict:
    # 未来可从 SystemConfig 覆盖价格，当前返回默认值
    return DEFAULT_PLANS


def _findMember(db: Session, userId: int) -> Member | None:
    return db.query(Member).filter(Member.userId == userId).first()


def getInfo(db: Session, userId: int) -> dict | None:
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        return None

    rights = compute_user_rights(
        {
            "openId": user.openId,
            "status": user.status,
            "memberLevel": user.memberLevel,
            "memberExpireAt": user.memberExpireAt,
            "trialExpireAt": user.trialExpireAt,
        }
    )

    member = _findMember(db, userId)
    trial_expire_at = rights.get("trialExpireAt")
    return {
        "id": user.id,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "memberLevel": rights["memberLevel"],
        "isPaidMember": rights["isPaidMember"],
        "isTrialActive": rights["isTrialActive"],
        "trialExpireAt": trial_expire_at.isoformat() if trial_expire_at else None,
        "memberExpireDate": user.memberExpireAt.isoformat() if user.memberExpireAt else None,
        "planType": member.planType if member else None,
        "canUseFeature": rights["canUseFeature"],
    }


def activate(db: Session, userId: int, planType: str) -> None:
    plans = getPlans()
    plan = plans.get(planType)
    if not plan:
        raise BusinessError(400, "无效的套餐类型")

    now = datetime.now()
    future = now + timedelta(days=plan["days"])

    user = db.query(User).filter(User.id == userId).first()
    if not user:
        raise BusinessError(404, "用户不存在")

    # 计算新的 memberExpireAt：若当前会员未过期则续期
    new_expire_at = future
    if user.memberExpireAt and user.memberExpireAt > now:
        new_expire_at = user.memberExpireAt + timedelta(days=plan["days"])

    try:
        user.memberLevel = plan["memberLevel"]
        user.memberExpireAt = new_expire_at
        user.updatedAt = now

        member = _findMember(db, userId)
        if member:
            member.planType = planType
            member.startDate = now
            member.expireDate = new_expire_at
            member.status = 1
            member.updatedAt = now
        else:
            db.add(
                Member(
                    userId=userId,
                    planType=planType,
                    startDate=now,
                    expireDate=new_expire_at,
                    status=1,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise


def generateOrderNo() -> str:
    return "SK" + str(int(datetime.now().timestamp() * 1000)) + str(random.randint(0, 999))


def createOrder(
    db: Session, userId: int, planType: str, payChannel: str = "wechat"
) -> dict:
    plans = getPlans()
    plan = plans.get(planType)
    if not plan:
        raise BusinessError(400, "无效的套餐类型")

    orderNo = generateOrderNo()
    order = Order(
        userId=userId,
        orderNo=orderNo,
        planType=planType,
        amount=plan["price"],
        payChannel=payChannel,
        payStatus=0,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "id": order.id,
        "orderNo": order.orderNo,
        "planType": order.planType,
        "amount": order.amount,
        "payStatus": order.payStatus,
        "createdAt": order.createdAt.isoformat() if order.createdAt else None,
    }


def markPaid(db: Session, orderNo: str, payChannel: str | None = None) -> None:
    order = db.query(Order).filter(Order.orderNo == orderNo).first()
    if not order:
        raise BusinessError(404, "订单不存在")
    if order.payStatus == 1:
        return

    update_data = {"payStatus": 1, "payTime": datetime.now()}
    if payChannel:
        update_data["payChannel"] = payChannel

    try:
        db.query(Order).filter(Order.orderNo == orderNo).update(update_data)
        db.commit()
    except Exception:
        db.rollback()
        raise

    activate(db, order.userId, order.planType)


def checkIsMember(db: Session, userId: int) -> bool:
    """判断用户是否为有效付费会员（custom_quote_service 依赖）"""
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        return False
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
    return bool(rights["isPaidMember"])
