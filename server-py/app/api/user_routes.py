"""用户路由

对应 TypeScript 版 server/src/routes/user_routes.ts + user_controller.ts
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_optional_user_id
from ..models import User
from ..services import auth_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/user", tags=["user"])


@router.get("/me")
async def get_me(
    user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    if not user_id:
        return ok(None)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return ok(None)
    return ok(auth_service.buildUserInfo(user))
