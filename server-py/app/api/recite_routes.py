"""背诵计划路由

对应 TypeScript 版 server/src/routes/recite_routes.ts + recite_controller.ts
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import recite_plan_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/recite", tags=["recite"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("")
@router.get("/")
async def list(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return ok(recite_plan_service.list(db, user_id))


@router.post("")
@router.post("/")
async def add(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    result = recite_plan_service.add(
        db, user_id,
        {"quoteId": body.get("quoteId"), "customQuoteId": body.get("customQuoteId")},
    )
    return ok(result)


@router.delete("/{id}")
async def remove(
    id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return ok({"msg": "placeholder, use prisma recitePlan.delete"})


@router.get("/today")
async def today(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return ok(recite_plan_service.todayReview(db, user_id))


@router.post("/review")
async def review(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    plan_id = body.get("planId")
    quality = body.get("quality")
    if not plan_id:
        raise BusinessError(400, "Missing planId")
    action = "not_skilled" if quality and quality <= 2 else "master"
    result = recite_plan_service.review(db, plan_id, user_id, action)
    return ok(result)


@router.get("/calendar")
async def calendar(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = None,
):
    all_stats = recite_plan_service.stats(db, user_id)
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    prefix = f"{y}-{str(m).zfill(2)}"
    days = [int(k[-2:]) for k in all_stats["calendar"] if k.startswith(prefix)]
    return ok(days)


@router.get("/stats")
async def stats(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return ok(recite_plan_service.stats(db, user_id))
