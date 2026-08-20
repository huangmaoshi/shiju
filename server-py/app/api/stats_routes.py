"""统计路由（对应 TS server/src/routes/stats_routes.ts + stats_controller.ts）"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user_id, require_admin
from ..services import stats_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("/home")
async def home_stats(db: Session = Depends(get_db)):
    """公开接口：首页统计数据（无需登录）"""
    return ok(stats_service.homeStats(db))


@router.get(
    "/dashboard",
    dependencies=[Depends(get_current_user_id), Depends(require_admin)],
)
async def dashboard(db: Session = Depends(get_db)):
    """管理员接口：Dashboard 统计"""
    return ok(stats_service.dashboard(db))
