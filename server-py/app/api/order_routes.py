"""订单路由（对应 TS order_routes.ts + order_controller.ts）"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError
from ..services import order_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/order", tags=["order"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.post("/pay/callback")
async def pay_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await _body(request)
    order_no = body.get("orderNo")
    if not order_no:
        raise BusinessError(400, "Missing orderNo")
    order_service.markPaid(db, order_no)
    return ok(None)
