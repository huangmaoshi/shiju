"""AI 管理路由（对应 TS server/src/routes/ai_routes.ts + ai_controller.ts）

全部端点需要 admin 权限（router.use(adminRequired)）。
ai_service 入口函数同步返回 dict，后台任务内部已用 threading 处理，handler 直接调用。
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, require_admin
from ..services import ai_service
from ..utils.response import ok

router = APIRouter(
    prefix="/api/v1/ai", tags=["ai"], dependencies=[Depends(require_admin)]
)


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _to_int(value, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _ids(value):
    if not isinstance(value, list) or len(value) == 0:
        return None
    return [_to_int(i) for i in value if _to_int(i) is not None]


# ========== AiConfig ==========


@router.get("/configs")
async def config_list(db: Session = Depends(get_db)):
    return ok(ai_service.list_configs(db))


@router.post("/configs")
async def config_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    if not body.get("name") or not body.get("provider") or not body.get("baseUrl") or not body.get("model"):
        raise BusinessError(400, "缺少必要字段（name / provider / baseUrl / model）")
    # local 类型的本地/自建模型可以不需要 API Key
    if body.get("provider") != "local" and not body.get("apiKey"):
        raise BusinessError(400, "缺少必要字段（apiKey）")
    return ok(ai_service.create_config(db, body))


@router.get("/configs/{config_id}")
async def config_get(config_id: int, db: Session = Depends(get_db)):
    return ok(ai_service.get_config(db, config_id))


@router.put("/configs/{config_id}")
async def config_update(config_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    return ok(ai_service.update_config(db, config_id, body))


@router.delete("/configs/{config_id}")
async def config_delete(config_id: int, db: Session = Depends(get_db)):
    ai_service.delete_config(db, config_id)
    return ok(None)


@router.post("/configs/{config_id}/default")
async def config_set_default(config_id: int, db: Session = Depends(get_db)):
    return ok(ai_service.set_default_config(db, config_id))


# ========== AiExtractTask ==========


@router.get("/tasks")
async def task_list(db: Session = Depends(get_db)):
    return ok(ai_service.list_tasks(db))


@router.get("/tasks/{task_id}")
async def task_get(task_id: int, db: Session = Depends(get_db)):
    return ok(ai_service.get_task(db, task_id))


@router.delete("/tasks/{task_id}")
async def task_delete(task_id: int, db: Session = Depends(get_db)):
    ai_service.delete_task(db, task_id)
    return ok(None)


# ========== 金句提取 ==========


@router.post("/extract/single")
async def extract_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    original_text_id = _to_int(body.get("originalTextId"))
    if not config_id or not original_text_id:
        raise BusinessError(400, "缺少必要字段（configId / originalTextId）")
    return ok(ai_service.extract_from_text(db, config_id, original_text_id))


@router.post("/extract/batch")
async def extract_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("originalTextIds"))
    if not config_id:
        raise BusinessError(400, "缺少必要字段（configId）")
    if not ids:
        raise BusinessError(400, "originalTextIds 必须为非空数组")
    return ok(ai_service.extract_from_batch(db, config_id, ids))


# ====== 拼音生成 ======


@router.post("/pinyin/quote/single")
async def pinyin_quote_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote_id = _to_int(body.get("quoteId"))
    config_id = _to_int(body.get("configId"))
    if not quote_id:
        raise BusinessError(400, "缺少必要字段（quoteId）")
    return ok(ai_service.generate_pinyin_for_quote(db, quote_id, config_id))


@router.post("/pinyin/quote/batch")
async def pinyin_quote_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("quoteIds"))
    if not ids:
        raise BusinessError(400, "quoteIds 必须为非空数组")
    return ok(ai_service.generate_pinyin_for_quotes_batch(db, ids, config_id))


@router.post("/pinyin/original-text/single")
async def pinyin_original_text_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    original_text_id = _to_int(body.get("originalTextId"))
    config_id = _to_int(body.get("configId"))
    if not original_text_id:
        raise BusinessError(400, "缺少必要字段（originalTextId）")
    return ok(ai_service.generate_pinyin_for_original_text(db, original_text_id, config_id))


@router.post("/pinyin/original-text/batch")
async def pinyin_original_text_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("originalTextIds"))
    if not ids:
        raise BusinessError(400, "originalTextIds 必须为非空数组")
    return ok(ai_service.generate_pinyin_for_original_texts_batch(db, ids, config_id))


# ====== 繁转简 ======


@router.post("/simplify/text")
async def simplify_text(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    text = body.get("text")
    config_id = _to_int(body.get("configId"))
    if not text:
        raise BusinessError(400, "缺少必要字段（text）")
    result = ai_service.simplify_text(db, text, config_id)
    return ok({"simplifiedText": result})


@router.post("/simplify/quote/single")
async def simplify_quote_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote_id = _to_int(body.get("quoteId"))
    config_id = _to_int(body.get("configId"))
    if not quote_id:
        raise BusinessError(400, "缺少必要字段（quoteId）")
    return ok(ai_service.simplify_quote(db, quote_id, config_id))


@router.post("/simplify/quote/batch")
async def simplify_quotes_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("quoteIds"))
    if not ids:
        raise BusinessError(400, "quoteIds 必须为非空数组")
    return ok(ai_service.simplify_quotes_batch(db, ids, config_id))


@router.post("/simplify/original-text/single")
async def simplify_original_text_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    original_text_id = _to_int(body.get("originalTextId"))
    config_id = _to_int(body.get("configId"))
    if not original_text_id:
        raise BusinessError(400, "缺少必要字段（originalTextId）")
    return ok(ai_service.simplify_original_text(db, original_text_id, config_id))


@router.post("/simplify/original-text/batch")
async def simplify_original_texts_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("originalTextIds"))
    if not ids:
        raise BusinessError(400, "originalTextIds 必须为非空数组")
    return ok(ai_service.simplify_original_texts_batch(db, ids, config_id))


# ====== 一键批量处理 ======


@router.get("/one-click/stats")
async def one_click_stats(db: Session = Depends(get_db)):
    return ok(ai_service.get_one_click_stats(db))


@router.post("/one-click/pinyin")
async def one_click_pinyin(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    limit = _to_int(body.get("limit"))
    return ok(ai_service.one_click_pinyin_all(db, config_id, limit))


@router.post("/one-click/extract")
async def one_click_extract(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    if not config_id:
        raise BusinessError(400, "缺少必要字段（configId）")
    limit = _to_int(body.get("limit"))
    return ok(ai_service.one_click_extract_all(db, config_id, limit))


@router.post("/one-click/simplify-local")
async def one_click_simplify_local(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    limit = _to_int(body.get("limit"))
    return ok(ai_service.one_click_simplify_all_local(db, limit))


# ====== AI 自动分类 ======


@router.post("/classify/quote/single")
async def classify_quote_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote_id = _to_int(body.get("quoteId"))
    config_id = _to_int(body.get("configId"))
    if not quote_id:
        raise BusinessError(400, "缺少必要字段（quoteId）")
    return ok(ai_service.classify_quote(db, quote_id, config_id))


@router.post("/classify/quote/batch")
async def classify_quote_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("quoteIds"))
    if not ids:
        raise BusinessError(400, "quoteIds 必须为非空数组")
    return ok(ai_service.classify_quotes_batch(db, ids, config_id))


@router.post("/classify/original-text/single")
async def classify_original_text_single(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    original_text_id = _to_int(body.get("originalTextId"))
    config_id = _to_int(body.get("configId"))
    if not original_text_id:
        raise BusinessError(400, "缺少必要字段（originalTextId）")
    return ok(ai_service.classify_original_text(db, original_text_id, config_id))


@router.post("/classify/original-text/batch")
async def classify_original_text_batch(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    ids = _ids(body.get("originalTextIds"))
    if not ids:
        raise BusinessError(400, "originalTextIds 必须为非空数组")
    return ok(ai_service.classify_original_texts_batch(db, ids, config_id))


@router.get("/one-click/classify-stats")
async def one_click_classify_stats(db: Session = Depends(get_db)):
    return ok(ai_service.get_one_click_classify_stats(db))


@router.post("/one-click/classify")
async def one_click_classify(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    config_id = _to_int(body.get("configId"))
    limit = _to_int(body.get("limit"))
    return ok(ai_service.one_click_classify_all(db, config_id, limit))
