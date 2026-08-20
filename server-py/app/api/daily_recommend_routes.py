"""每日推荐路由（对应 TS daily_recommend_routes.ts + daily_recommend_controller.ts）"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import daily_recommend_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/daily-recommend", tags=["daily-recommend"])


@router.get("/today")
async def get_today(db: Session = Depends(get_db)):
    return ok(daily_recommend_service.getToday(db))


@router.get("/history")
async def get_history(db: Session = Depends(get_db)):
    return ok(daily_recommend_service.getToday(db))


@router.get("/{date}")
async def get_by_date(date: str, db: Session = Depends(get_db)):
    return ok(daily_recommend_service.getByDate(db, date))
