"""会员路由（对应 TS member_routes.ts + member_controller.ts）"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import member_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/member", tags=["member"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("/info")
async def get_info(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    result = member_service.getInfo(db, user_id)
    return ok(result)


@router.get("/plans")
async def get_plans():
    return ok(member_service.getPlans())


@router.post("/order")
async def create_order(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    plan_type = body.get("planType")
    if not plan_type:
        raise BusinessError(400, "Missing planType")
    pay_channel = body.get("payChannel") or "wechat"
    result = member_service.createOrder(db, user_id, plan_type, pay_channel)
    return ok(result)


@router.post("/pay/callback")
async def pay_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await _body(request)
    order_no = body.get("orderNo")
    if not order_no:
        raise BusinessError(400, "Missing orderNo")
    member_service.markPaid(db, order_no, body.get("payChannel"))
    return ok(None)
