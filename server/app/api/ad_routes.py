"""广告路由（对应 TS ad_routes.ts + ad_controller.ts）"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import ad_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/ad", tags=["ad"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("/configs")
async def get_configs(
    position: str | None = None,
    platform: str | None = None,
    db: Session = Depends(get_db),
):
    if not position:
        raise BusinessError(400, "Missing position")
    return ok(ad_service.getConfigs(db, position, platform))


@router.post("/impression")
async def impression(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    ad_unit_id = body.get("adUnitId")
    if not ad_unit_id:
        raise BusinessError(400, "Missing adUnitId")
    ad_service.impression(db, user_id, ad_unit_id)
    return ok(None)


@router.post("/click")
async def click(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    ad_unit_id = body.get("adUnitId")
    if not ad_unit_id:
        raise BusinessError(400, "Missing adUnitId")
    ad_service.click(db, user_id, ad_unit_id)
    return ok(None)


@router.post("/reward-verify")
async def reward_verify(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    ad_unit_id = body.get("adUnitId")
    reward_token = body.get("rewardToken")
    if not ad_unit_id or not reward_token:
        raise BusinessError(400, "Missing adUnitId or rewardToken")
    return ok(ad_service.rewardVerify(db, user_id, ad_unit_id, reward_token))
