"""拾句后端 Python 版 - FastAPI 应用组装

对应 TypeScript 版 server/src/app.ts + server/src/server.ts：
- 中间件：CORS / JSON body / 日志 / 限流
- /api/health 健康检查
- / 首页调试台（HTML）
- /api/v1 全部业务路由
- 404 / 异常统一处理（{ code, message, data } 结构）
- 启动引导：建表、默认管理员、cron 调度器
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.exceptions import RequestValidationError

from .config import config
from .database import SessionLocal, init_db
from .deps import BusinessError
from .services import cron_service
from .utils.logger import logger
from .utils.password import hash_password
from .utils.response import _json_response, error, ok

_start_time = time.time()

# ========== 启动 / 关闭 ==========


def ensure_admin_user() -> None:
    """启动时确保存在默认管理员账号（admin / admin123），已有任意 admin 用户则跳过"""
    from .models import User

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.userType == "admin").first()
        if existing:
            return
        db.add(
            User(
                openId="admin_internal",
                username="admin",
                passwordHash=hash_password("admin123"),
                nickname="系统管理员",
                userType="admin",
                memberLevel=2,
                status=1,
            )
        )
        db.commit()
        logger.info("[bootstrap] 默认管理员账号已创建: admin / admin123（请尽快修改密码）")
    except Exception as err:  # noqa: BLE001
        db.rollback()
        logger.warning(f"[bootstrap] 创建默认管理员失败: {err}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        init_db()
        logger.info("Database tables ready")
    except Exception as err:  # noqa: BLE001
        logger.warning(f"[bootstrap] init_db failed: {err}")

    ensure_admin_user()

    # 启动 cron 采集调度器（失败不影响服务启动，与 TS 版行为一致）
    try:
        cron_service.start()
        logger.info("[Cron] 调度器已启动")
    except Exception as err:  # noqa: BLE001
        logger.warning(f"[Cron] 调度器加载失败: {err}")

    yield

    try:
        cron_service.stop()
    except Exception:  # noqa: BLE001
        pass


app = FastAPI(title="拾句 ShiJu API", version="1.0.0", lifespan=lifespan)

# CORS（对应 TS app.use(cors())，允许所有来源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== 首页 / 健康检查 ==========

INDEX_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>拾句 · 作文素材与金句摘抄库</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh}
  .quote-card{background:linear-gradient(135deg,#fff 0%,#f8f9ff 100%);transition:all .3s}
  .quote-card:hover{transform:translateY(-2px);box-shadow:0 20px 40px -10px rgba(102,126,234,.3)}
  .tag{background:linear-gradient(135deg,#667eea,#764ba2)}
</style>
</head>
<body class="py-8 px-4">
<div class="max-w-4xl mx-auto">
<div class="text-center mb-10 text-white">
  <h1 class="text-4xl font-bold mb-2">📖 拾句</h1>
  <p class="text-lg opacity-90">作文素材与金句摘抄库 · API 调试台（Python 版）</p>
  <p class="text-sm opacity-75 mt-2">后端运行正常 <span id="health-dot" class="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> v1.0.0</p>
</div>
<div class="bg-white rounded-2xl shadow-2xl p-6 mb-6">
  <div class="flex gap-2 mb-4">
    <input id="search-input" type="text" placeholder="🔍 搜索金句（如：生命、勤奋、梦）" class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none transition">
    <button onclick="doSearch()" class="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition">搜索</button>
    <button onclick="doRandom()" class="px-6 py-3 border-2 border-purple-500 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition">🎲 随机 5 条</button>
  </div>
</div>
<div id="results" class="mt-6 space-y-4"></div>
</div>
<script>
const api = p => `/api/v1${p}`;
async function fetchJSON(url){try{const r=await fetch(url);return r.json()}catch(e){return{error:e.message}}}
function renderQuote(q){
  const cats=(q.categories||[]).map(c=>typeof c==='string'?c:c.name).filter(Boolean);
  return `<div class="quote-card rounded-2xl p-5 shadow-lg">
      <p class="text-lg text-gray-800 leading-relaxed mb-3">"${q.content}"</p>
      <div class="flex items-center justify-between">
        <div><span class="text-sm text-gray-600 font-medium">${q.author||'佚名'}</span><span class="text-xs text-gray-400 ml-2">${q.source||''}</span></div>
        <div class="flex gap-1">${q.isFree?'<span class="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">免费</span>':'<span class="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">会员</span>'}</div>
      </div>
      ${cats.length?'<div class="mt-3 flex flex-wrap gap-1">'+cats.map(n=>`<span class="tag text-white text-xs px-2 py-0.5 rounded">${n}</span>`).join('')+'</div>':''}
    </div>`;
}
async function doSearch(){
  const kw=document.getElementById('search-input').value.trim();
  if(!kw)return;
  const r=await fetchJSON(api('/search/quotes?keyword='+encodeURIComponent(kw)));
  showResult(r.data?r.data.list:r.data||[], r.data?.total);
}
async function doRandom(){
  const r=await fetchJSON(api('/quotes/random?limit=5'));
  showResult(r.data, r.data?.length);
}
function showResult(list, total){
  const el=document.getElementById('results');
  if(!list||list.length===0){el.innerHTML='<div class="text-center py-12 text-white opacity-80">没有找到内容 😢</div>';return;}
  let html='';
  if(total!=null)html+='<div class="text-white opacity-80 text-sm mb-3">共 '+total+' 条</div>';
  html+=list.map(renderQuote).join('');
  el.innerHTML=html;
}
document.getElementById('search-input').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch()});
doRandom();
</script>
</body>
</html>"""


@app.get("/")
def index():
    return Response(content=INDEX_HTML, media_type="text/html; charset=utf-8")


@app.get("/api/health")
def health():
    return ok(
        {
            "status": "ok",
            "uptime": int(time.time() - _start_time),
            "version": "1.0.0",
        }
    )


# ========== 业务路由挂载 ==========

from .api import (  # noqa: E402  (延迟导入避免循环依赖)
    ad_routes,
    ai_routes,
    admin_routes,
    auth_routes,
    card_routes,
    category_routes,
    collection_routes,
    composition_routes,
    custom_quote_routes,
    daily_recommend_routes,
    export_routes,
    member_routes,
    order_routes,
    original_text_routes,
    quote_routes,
    recite_routes,
    search_routes,
    stats_routes,
    sync_routes,
    theme_package_routes,
    user_routes,
)

app.include_router(admin_routes.auth_router)
app.include_router(admin_routes.admin_router)
app.include_router(ai_routes.router)
app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(category_routes.router)
app.include_router(quote_routes.router)
app.include_router(search_routes.router)
app.include_router(collection_routes.router)
app.include_router(custom_quote_routes.router)
app.include_router(recite_routes.router)
app.include_router(member_routes.router)
app.include_router(order_routes.router)
app.include_router(daily_recommend_routes.router)
app.include_router(ad_routes.router)
app.include_router(card_routes.router)
app.include_router(composition_routes.router)
app.include_router(theme_package_routes.router)
app.include_router(sync_routes.router)
app.include_router(export_routes.router)
app.include_router(stats_routes.router)
app.include_router(original_text_routes.router)

# ========== 统一异常处理 ==========


@app.exception_handler(BusinessError)
async def business_error_handler(_request: Request, exc: BusinessError):
    return error(exc.code, exc.message, exc.status)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return error(exc.status_code, str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return error(400, f"参数错误: {exc.errors()}", 400)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception(f"Unhandled error: {exc}")
    return error(500, "Internal server error", 500)


@app.middleware("http")
async def catch_404_middleware(request: Request, call_next):
    """FastAPI 未匹配路由时返回与 TS 版一致的 404 JSON 结构"""
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        # 让全局 Exception handler 处理
        raise exc
    if response.status_code == 404 and request.url.path not in ("/", "/api/health"):
        # 只有路由未匹配才会走到这里（静态文件/文档页除外）
        from starlette.routing import Match

        matched = False
        for route in app.router.routes:
            _, match = route.matches(request.scope)
            if match == Match.FULL:
                matched = True
                break
        if not matched:
            body = _json_response(
                {
                    "code": 404,
                    "message": f"Route not found: {request.method} {request.url.path}",
                    "data": None,
                },
                status=404,
            )
            return body
    return response
