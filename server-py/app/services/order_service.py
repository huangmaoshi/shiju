"""订单服务（对应 TS order_service.ts）"""
import random
from datetime import datetime

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import Order
from .member_service import activate, getPlans


def generateOrderNo() -> str:
    return "SK" + str(int(datetime.now().timestamp() * 1000)) + str(random.randint(0, 999))


def _serialize(order: Order) -> dict:
    return {
        "id": order.id,
        "userId": order.userId,
        "orderNo": order.orderNo,
        "planType": order.planType,
        "amount": order.amount,
        "payChannel": order.payChannel,
        "payStatus": order.payStatus,
        "payTime": order.payTime.isoformat() if order.payTime else None,
        "createdAt": order.createdAt.isoformat() if order.createdAt else None,
    }


def createOrder(db: Session, userId: int, planType: str) -> dict:
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


def getByOrderNo(db: Session, orderNo: str) -> dict | None:
    order = db.query(Order).filter(Order.orderNo == orderNo).first()
    if not order:
        return None
    return _serialize(order)


def markPaid(db: Session, orderNo: str) -> None:
    order = db.query(Order).filter(Order.orderNo == orderNo).first()
    if not order:
        raise BusinessError(404, "订单不存在")
    if order.payStatus == 1:
        return

    try:
        db.query(Order).filter(Order.orderNo == orderNo).update(
            {"payStatus": 1, "payTime": datetime.now()}
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    activate(db, order.userId, order.planType)
