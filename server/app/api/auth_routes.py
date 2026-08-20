"""认证路由

对应 TypeScript 版 server/src/routes/auth_routes.ts + auth_controller.ts
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, check_login_limit, get_current_user_id
from ..services import auth_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.post("/wechat-login", dependencies=[Depends(check_login_limit)])
async def wechat_login(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    result = auth_service.wechatLogin(db, body.get("code"))
    return ok(result)


@router.post("/register", dependencies=[Depends(check_login_limit)])
async def register(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    username = body.get("username")
    password = body.get("password")
    nickname = body.get("nickname")
    if not username or not password:
        raise BusinessError(400, "账号和密码不能为空")
    result = auth_service.register(db, username, password, nickname)
    return ok(result)


@router.post("/login", dependencies=[Depends(check_login_limit)])
async def login(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    username = body.get("username")
    password = body.get("password")
    if not username or not password:
        raise BusinessError(400, "账号和密码不能为空")
    result = auth_service.login(db, username, password)
    return ok(result)


@router.post("/logout")
async def logout(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    auth_service.logout(db, user_id)
    return ok(None)


@router.post("/refresh")
async def refresh(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    token = body.get("token")
    if not token:
        raise BusinessError(400, "Missing token")
    result = auth_service.refresh(db, token)
    return ok(result)
