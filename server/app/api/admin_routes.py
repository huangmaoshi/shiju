"""管理后台路由（对应 TS server/src/routes/admin_routes.ts + admin_controller.ts）

- /auth 无需 admin 权限（前端探测用），放在独立 auth_router
- 其余所有端点均需 require_admin
- controller 逻辑直接内联在本文件 handler 中
"""
import json
import random
import re
import threading
import time
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..deps import BusinessError, require_admin
from ..models import (
    AdConfig,
    CardTemplate,
    Category,
    Collection,
    CrawlRecord,
    CrawlSchedule,
    CrawlSource,
    CrawlTask,
    Order,
    OriginalText,
    Quote,
    QuoteCategory,
    User,
)
from ..services import system_config_service
from ..services.cron_service import cron_scheduler
from ..services.github_import_service import import_from_github_raw
from ..utils.crawl_url import check_url_reachable, resolve_github_raw_url
from ..utils.password import hash_password
from ..utils.response import ok

# ========== 基础工具 ==========

auth_router = APIRouter(prefix="/api/v1/admin", tags=["admin-auth"])

admin_router = APIRouter(
    prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)]
)


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _serialize(obj) -> dict | None:
    """ORM 对象转 dict（按表列字段，datetime 交给 response 序列化）"""
    if obj is None:
        return None
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def _parse_date(s) -> datetime | None:
    """解析前端传入的日期字符串（对应 new Date(dateStr)）"""
    if not s:
        return None
    try:
        d = datetime.fromisoformat(str(s))
    except ValueError:
        try:
            d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        except ValueError:
            return None
    # 数据库统一存 naive datetime
    if d.tzinfo is not None:
        d = d.astimezone().replace(tzinfo=None)
    return d


def _is_number(value) -> bool:
    try:
        int(value)
        return True
    except (TypeError, ValueError):
        return False


def _num(v):
    """转 int，失败返回 None（对应 Number(x) 的 NaN 场景按 null 处理）"""
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _rand36(n: int = 6) -> str:
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    return "".join(random.choice(chars) for _ in range(n))


# ========== Auth（无需 admin 权限） ==========


@auth_router.post("/auth")
async def auth_check():
    return ok({"ok": True})


# ========== Dashboard ==========


@admin_router.get("/dashboard")
async def dashboard(db: Session = Depends(get_db)):
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = db.query(User).count()
    total_quotes = db.query(Quote).filter(Quote.isActive == True).count()
    total_collections = db.query(Collection).count()
    member_count = db.query(User).filter(User.memberLevel > 0).count()
    today_new_users = db.query(User).filter(User.createdAt >= today_start).count()
    today_new_quotes = db.query(Quote).filter(Quote.createdAt >= today_start).count()

    recent_tasks = (
        db.query(CrawlTask).order_by(CrawlTask.createdAt.desc()).limit(10).all()
    )
    source_ids = list({t.sourceId for t in recent_tasks if t.sourceId})
    source_map = {}
    if source_ids:
        for s in db.query(CrawlSource).filter(CrawlSource.id.in_(source_ids)).all():
            source_map[s.id] = s
    recent_crawlers = []
    for t in recent_tasks:
        item = _serialize(t)
        src = source_map.get(t.sourceId) if t.sourceId else None
        item["source"] = {"name": src.name} if src else None
        recent_crawlers.append(item)

    today_revenue = (
        db.query(func.coalesce(func.sum(Order.amount), 0))
        .filter(Order.payStatus == 1, Order.createdAt >= today_start)
        .scalar()
    )

    top_quotes = (
        db.query(Quote)
        .order_by(Quote.favCount.desc())
        .limit(5)
        .all()
    )
    top_quotes_data = [
        {"id": q.id, "content": q.content, "author": q.author, "favCount": q.favCount}
        for q in top_quotes
    ]

    return ok(
        {
            "totalUsers": total_users,
            "totalQuotes": total_quotes,
            "totalCollections": total_collections,
            "memberCount": member_count,
            "todayNewUsers": today_new_users,
            "todayNewQuotes": today_new_quotes,
            "todayRevenue": today_revenue or 0,
            "recentCrawlers": recent_crawlers,
            "topQuotes": top_quotes_data,
        }
    )


# ========== Stats（数据统计） ==========


@admin_router.get("/stats/overview")
async def stats_overview(db: Session = Depends(get_db)):
    now = datetime.now()
    seven_days_ago = now - timedelta(days=7)

    users = (
        db.query(User.createdAt).filter(User.createdAt >= seven_days_ago).all()
    )
    quotes = (
        db.query(Quote.createdAt).filter(Quote.createdAt >= seven_days_ago).all()
    )

    def group_by_date(rows):
        m = {}
        for (d,) in rows:
            key = d.strftime("%Y-%m-%d") if d else ""
            m[key] = m.get(key, 0) + 1
        return [{"date": k, "count": v} for k, v in sorted(m.items())]

    return ok({"dailyUsers": group_by_date(users), "dailyQuotes": group_by_date(quotes)})


# ========== Quotes（金句管理） ==========


@admin_router.get("/quotes")
async def quote_list(
    request: Request,
    keyword: str | None = None,
    categoryId: str | None = None,
    isActive: str | None = None,
    auditStatus: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
):
    take = pageSize or 20
    skip = ((page or 1) - 1) * take

    conditions = []
    if keyword:
        conditions.append(Quote.content.contains(keyword))
    if categoryId and categoryId != "":
        quote_ids = [
            r[0]
            for r in db.query(QuoteCategory.quoteId)
            .filter(QuoteCategory.categoryId == int(categoryId))
            .all()
        ]
        conditions.append(Quote.id.in_(quote_ids))
    if isActive is not None and isActive != "":
        conditions.append(Quote.isActive == (isActive == "true"))
    if auditStatus is not None and auditStatus != "":
        conditions.append(Quote.auditStatus == int(auditStatus))

    query = db.query(Quote)
    if conditions:
        query = query.filter(*conditions)
    total = query.count()
    quotes = (
        query.order_by(Quote.createdAt.desc()).offset(skip).limit(take).all()
    )

    quote_ids = [q.id for q in quotes]
    cat_map = {}
    if quote_ids:
        qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId.in_(quote_ids)).all()
        cat_ids = list({qc.categoryId for qc in qcs})
        cats = {}
        if cat_ids:
            for c in db.query(Category).filter(Category.id.in_(cat_ids)).all():
                cats[c.id] = c
        for qc in qcs:
            c = cats.get(qc.categoryId)
            if c:
                cat_map.setdefault(qc.quoteId, []).append(
                    {"category": {"id": c.id, "name": c.name}}
                )

    list_data = []
    for q in quotes:
        item = _serialize(q)
        item["quoteCategories"] = cat_map.get(q.id, [])
        list_data.append(item)

    return ok(
        {
            "list": list_data,
            "total": total,
            "page": page or 1,
            "pageSize": take,
        }
    )


@admin_router.post("/quotes")
async def quote_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    content = body.get("content")
    if not content:
        raise BusinessError(400, "内容不能为空")

    quote = Quote(
        content=content,
        author=body.get("author") or None,
        source=body.get("source") or None,
        sourceUrl=body.get("sourceUrl") or None,
        summary=body.get("summary") or None,
        tags=body.get("tags") or None,
        pinyinData=body.get("pinyinData") or None,
        wordCount=len(content),
        isFree=body.get("isFree", True),
        isActive=body.get("isActive", True),
        provider=body.get("provider") or "admin",
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)

    category_ids = body.get("categoryIds")
    if isinstance(category_ids, list) and len(category_ids) > 0:
        for cid in category_ids:
            db.add(QuoteCategory(quoteId=quote.id, categoryId=int(cid)))
        db.commit()

    return ok(_serialize(quote))


@admin_router.put("/quotes/{quote_id}")
async def quote_update(quote_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)

    update_data = {}
    for field in ("content", "author", "source", "sourceUrl", "summary", "tags", "isFree", "isActive"):
        if body.get(field) is not None:
            update_data[field] = body[field]
    if update_data:
        db.query(Quote).filter(Quote.id == quote_id).update(
            update_data, synchronize_session=False
        )
        db.commit()

    if body.get("categoryIds") is not None:
        db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).delete(
            synchronize_session=False
        )
        for cid in body["categoryIds"]:
            db.add(QuoteCategory(quoteId=quote_id, categoryId=int(cid)))
        db.commit()

    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    return ok(_serialize(quote))


@admin_router.delete("/quotes/{quote_id}")
async def quote_delete(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)
    db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).delete(
        synchronize_session=False
    )
    db.query(Quote).filter(Quote.id == quote_id).delete()
    db.commit()
    return ok(None)


@admin_router.put("/quotes/{quote_id}/toggle")
async def quote_toggle(quote_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)
    if body.get("isActive") is not None:
        quote.isActive = bool(body["isActive"])
    db.commit()
    db.refresh(quote)
    return ok(_serialize(quote))


# ========== Categories（分类管理） ==========


@admin_router.get("/categories")
async def category_list(db: Session = Depends(get_db)):
    # 与 TS 版一致：返回扁平数组，每项带 children（子分类列表）与 parent（{id,name} 或 null）
    all_cats = db.query(Category).order_by(Category.sort.asc(), Category.id.asc()).all()
    node_map = {c.id: _serialize(c) for c in all_cats}
    for c in all_cats:
        node_map[c.id]["children"] = []
        node_map[c.id]["parent"] = None

    for c in all_cats:
        node = node_map[c.id]
        parent = node_map.get(c.parentId) if c.parentId else None
        if parent is not None:
            node["parent"] = {"id": parent["id"], "name": parent["name"]}
            parent["children"].append(node)

    return ok([node_map[c.id] for c in all_cats])


@admin_router.post("/categories")
async def category_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    name = body.get("name")
    type_ = body.get("type")
    if not name or not type_:
        raise BusinessError(400, "名称和类型不能为空")

    item = Category(
        name=name,
        type=type_,
        parentId=body.get("parentId") or None,
        sort=body.get("sort", 0),
        status=body.get("status", 1),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.put("/categories/{category_id}")
async def category_update(category_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    item = db.query(Category).filter(Category.id == category_id).first()
    if not item:
        raise BusinessError(404, "分类不存在", 404)

    for field in ("name", "type", "parentId", "sort", "status"):
        if body.get(field) is not None:
            setattr(item, field, body[field])
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.delete("/categories/{category_id}")
async def category_delete(category_id: int, db: Session = Depends(get_db)):
    child_count = (
        db.query(Category).filter(Category.parentId == category_id).count()
    )
    if child_count > 0:
        raise BusinessError(400, "存在子分类，无法删除")

    db.query(QuoteCategory).filter(QuoteCategory.categoryId == category_id).delete(
        synchronize_session=False
    )
    db.query(Category).filter(Category.id == category_id).delete()
    db.commit()
    return ok(None)


# ========== Users（用户管理） ==========


def _serialize_user(u: User) -> dict:
    return {
        field: getattr(u, field)
        for field in (
            "id", "openId", "username", "nickname", "avatar", "gender",
            "userType", "memberLevel", "memberExpireAt", "trialExpireAt",
            "status", "createdAt", "lastLoginAt",
        )
    }


@admin_router.get("/users")
async def user_list(
    request: Request,
    keyword: str | None = None,
    status: str | None = None,
    memberLevel: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
):
    take = pageSize or 15
    skip = ((page or 1) - 1) * take

    conditions = []
    if keyword:
        conditions.append(
            or_(
                User.nickname.contains(keyword),
                User.openId.contains(keyword),
                User.username.contains(keyword),
            )
        )
    if status is not None and status != "":
        conditions.append(User.status == int(status))
    if memberLevel is not None and memberLevel != "":
        conditions.append(User.memberLevel == int(memberLevel))

    query = db.query(User)
    if conditions:
        query = query.filter(*conditions)
    total = query.count()
    users = query.order_by(User.createdAt.desc()).offset(skip).limit(take).all()

    return ok(
        {
            "list": [_serialize_user(u) for u in users],
            "total": total,
            "page": page or 1,
            "pageSize": take,
        }
    )


@admin_router.post("/users")
async def user_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    username = body.get("username")
    password = body.get("password")
    nickname = body.get("nickname")
    member_level = body.get("memberLevel")
    member_expire_at = body.get("memberExpireAt")
    trial_expire_at = body.get("trialExpireAt")
    status = body.get("status")
    user_type = body.get("userType")

    if not username:
        raise BusinessError(400, "用户名不能为空")

    existing = (
        db.query(User)
        .filter(or_(User.username == username, User.openId == username))
        .first()
    )
    if existing:
        raise BusinessError(409, "用户名已存在", 409)

    final_user_type = user_type if user_type in ("admin", "wechat") else "account"

    open_id = f"account_{int(time.time() * 1000)}_{_rand36(6)}"
    data = {
        "openId": open_id,
        "username": username,
        "nickname": nickname or username,
        "userType": final_user_type,
        "status": status if status is not None else 1,
        "memberLevel": 2 if final_user_type == "admin" else (member_level or 0),
    }
    if password:
        data["passwordHash"] = hash_password(password)
    if member_expire_at:
        data["memberExpireAt"] = _parse_date(member_expire_at)
    if trial_expire_at:
        data["trialExpireAt"] = _parse_date(trial_expire_at)

    user = User(**data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return ok(_serialize(user))


@admin_router.put("/users/{user_id}")
async def user_update(user_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BusinessError(404, "用户不存在", 404)

    if body.get("nickname") is not None:
        user.nickname = body["nickname"]

    if body.get("username") is not None:
        dup = (
            db.query(User)
            .filter(User.username == body["username"], User.id != user_id)
            .first()
        )
        if dup:
            raise BusinessError(409, "用户名已存在", 409)
        user.username = body["username"]

    if body.get("status") is not None:
        user.status = body["status"]

    if body.get("userType") is not None:
        t = body["userType"]
        user.userType = t if t in ("admin", "wechat") else "account"
        if user.userType == "admin":
            user.memberLevel = 2

    if body.get("memberLevel") is not None:
        user.memberLevel = body["memberLevel"]

    if body.get("memberExpireAt") is not None:
        user.memberExpireAt = _parse_date(body["memberExpireAt"])
    if body.get("trialExpireAt") is not None:
        user.trialExpireAt = _parse_date(body["trialExpireAt"])

    if body.get("resetPassword"):
        user.passwordHash = hash_password(body["resetPassword"])

    db.commit()
    db.refresh(user)
    return ok(_serialize(user))


@admin_router.put("/users/{user_id}/ban")
async def user_ban(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BusinessError(404, "用户不存在", 404)
    user.status = 0
    db.commit()
    db.refresh(user)
    return ok(_serialize(user))


@admin_router.put("/users/{user_id}/unban")
async def user_unban(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BusinessError(404, "用户不存在", 404)
    user.status = 1
    db.commit()
    db.refresh(user)
    return ok(_serialize(user))


@admin_router.delete("/users/{user_id}")
async def user_delete(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BusinessError(404, "用户不存在", 404)
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    return ok(None)


# ========== System Config（系统配置） ==========


@admin_router.get("/system-config")
async def system_config_list(db: Session = Depends(get_db)):
    return ok(system_config_service.list(db))


@admin_router.put("/system-config")
async def system_config_batch_update(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    items = body.get("items") or []
    system_config_service.batchUpdate(db, items)
    return ok(None)


# ========== Payment Config（支付配置） ==========


@admin_router.get("/payment-config")
async def payment_config_list(db: Session = Depends(get_db)):
    return ok(system_config_service.listPaymentConfigs(db))


@admin_router.post("/payment-config")
async def payment_config_upsert(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    return ok(system_config_service.upsertPaymentConfig(db, body))


# ========== Ads（广告管理） ==========


@admin_router.get("/ads")
async def ad_list(db: Session = Depends(get_db)):
    rows = db.query(AdConfig).order_by(AdConfig.priority.desc()).all()
    return ok([_serialize(r) for r in rows])


@admin_router.post("/ads")
async def ad_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    position = body.get("position")
    if not position:
        raise BusinessError(400, "广告位不能为空")

    item = AdConfig(
        position=position,
        title=body.get("title") or None,
        imageUrl=body.get("imageUrl") or None,
        targetUrl=body.get("targetUrl") or None,
        adType=body.get("adType") or None,
        adUnitId=body.get("adUnitId") or None,
        platform=body.get("platform") or None,
        frequency=body.get("frequency", 3),
        priority=body.get("priority", 0),
        isActive=body.get("isActive", True),
        status=body.get("status", 1),
        startAt=_parse_date(body.get("startAt")),
        endAt=_parse_date(body.get("endAt")),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.put("/ads/{ad_id}")
async def ad_update(ad_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    item = db.query(AdConfig).filter(AdConfig.id == ad_id).first()
    if not item:
        raise BusinessError(404, "广告不存在", 404)

    for field in ("position", "title", "imageUrl", "targetUrl", "adType",
                  "adUnitId", "platform", "frequency", "priority",
                  "isActive", "status"):
        if body.get(field) is not None:
            setattr(item, field, body[field])
    if body.get("startAt") is not None:
        item.startAt = _parse_date(body["startAt"])
    if body.get("endAt") is not None:
        item.endAt = _parse_date(body["endAt"])

    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.delete("/ads/{ad_id}")
async def ad_delete(ad_id: int, db: Session = Depends(get_db)):
    item = db.query(AdConfig).filter(AdConfig.id == ad_id).first()
    if not item:
        raise BusinessError(404, "广告不存在", 404)
    db.query(AdConfig).filter(AdConfig.id == ad_id).delete()
    db.commit()
    return ok(None)


# ========== Card Templates（卡片模板管理） ==========


@admin_router.get("/cards")
async def card_list(db: Session = Depends(get_db)):
    rows = db.query(CardTemplate).order_by(CardTemplate.id.asc()).all()
    return ok([_serialize(r) for r in rows])


@admin_router.post("/cards")
async def card_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    name = body.get("name")
    if not name:
        raise BusinessError(400, "模板名称不能为空")

    item = CardTemplate(
        name=name,
        style=body.get("style") or "classic",
        bgType=body.get("bgType") or "color",
        bgValue=body.get("bgValue") or "#ffffff",
        fontFamily=body.get("fontFamily") or "system",
        fontSize=body.get("fontSize", 18),
        fontColor=body.get("fontColor") or "#333333",
        lineHeight=body.get("lineHeight", 1.8),
        textAlign=body.get("textAlign") or "center",
        showAuthor=body.get("showAuthor", 1),
        showWatermark=body.get("showWatermark", 1),
        isMember=body.get("isMember", 0),
        status=body.get("status", 1),
        previewUrl=body.get("previewUrl") or None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.put("/cards/{card_id}")
async def card_update(card_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    item = db.query(CardTemplate).filter(CardTemplate.id == card_id).first()
    if not item:
        raise BusinessError(404, "模板不存在", 404)

    for field in ("name", "style", "bgType", "bgValue", "fontFamily", "fontSize",
                  "fontColor", "lineHeight", "textAlign", "showAuthor",
                  "showWatermark", "isMember", "status", "previewUrl"):
        if body.get(field) is not None:
            setattr(item, field, body[field])

    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.delete("/cards/{card_id}")
async def card_delete(card_id: int, db: Session = Depends(get_db)):
    item = db.query(CardTemplate).filter(CardTemplate.id == card_id).first()
    if not item:
        raise BusinessError(404, "模板不存在", 404)
    db.query(CardTemplate).filter(CardTemplate.id == card_id).delete()
    db.commit()
    return ok(None)


# ========== Crawl Sources（采集源管理） ==========


@admin_router.get("/crawl/sources")
async def crawl_sources(db: Session = Depends(get_db)):
    rows = db.query(CrawlSource).order_by(CrawlSource.priority.desc()).all()
    return ok([_serialize(r) for r in rows])


@admin_router.post("/crawl/sources")
async def crawl_source_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    name = body.get("name")
    code = body.get("code")
    base_url = body.get("baseUrl")
    if not name or not code or not base_url:
        raise BusinessError(400, "名称、编码和基础URL不能为空")

    item = CrawlSource(
        name=name,
        code=code,
        baseUrl=base_url,
        type=body.get("type") or "html",
        datasetType=body.get("datasetType") or None,
        complianceTag=body.get("complianceTag") or None,
        protocol=body.get("protocol") or None,
        datasetSize=_num(body.get("datasetSize")),
        needTranslate=body.get("needTranslate") is True,
        categoryType=body.get("categoryType") or None,
        categoryId=_num(body.get("categoryId")),
        charset=body.get("charset") or "utf-8",
        userAgent=body.get("userAgent") or None,
        qpsLimit=body.get("qpsLimit", 5),
        maxDepth=body.get("maxDepth", 3),
        status=body.get("status", 1),
        priority=body.get("priority", 0),
        remark=body.get("remark") or None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.put("/crawl/sources/{source_id}")
async def crawl_source_update(source_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    item = db.query(CrawlSource).filter(CrawlSource.id == source_id).first()
    if not item:
        raise BusinessError(404, "采集源不存在", 404)

    if body.get("name") is not None:
        item.name = body["name"]
    if body.get("baseUrl") is not None:
        item.baseUrl = body["baseUrl"]
    if body.get("type") is not None:
        item.type = body["type"]
    if body.get("datasetType") is not None:
        item.datasetType = body["datasetType"]
    if body.get("complianceTag") is not None:
        item.complianceTag = body["complianceTag"]
    if body.get("protocol") is not None:
        item.protocol = body["protocol"]
    if body.get("datasetSize") is not None:
        item.datasetSize = _num(body["datasetSize"])
    if body.get("needTranslate") is True:
        item.needTranslate = True
    elif body.get("needTranslate") is False:
        item.needTranslate = False
    if body.get("categoryType") is not None:
        item.categoryType = body["categoryType"]
    if body.get("categoryId") is not None:
        item.categoryId = _num(body["categoryId"])
    if body.get("charset") is not None:
        item.charset = body["charset"]
    if body.get("userAgent") is not None:
        item.userAgent = body["userAgent"]
    if body.get("qpsLimit") is not None:
        item.qpsLimit = _num(body["qpsLimit"])
    if body.get("maxDepth") is not None:
        item.maxDepth = _num(body["maxDepth"])
    if body.get("status") is not None:
        item.status = _num(body["status"])
    if body.get("priority") is not None:
        item.priority = _num(body["priority"])
    if body.get("remark") is not None:
        item.remark = body["remark"]

    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.delete("/crawl/sources/{source_id}")
async def crawl_source_delete(source_id: int, db: Session = Depends(get_db)):
    item = db.query(CrawlSource).filter(CrawlSource.id == source_id).first()
    if not item:
        raise BusinessError(404, "采集源不存在", 404)
    db.query(CrawlSource).filter(CrawlSource.id == source_id).delete()
    db.commit()
    return ok(None)


# ========== Crawl Tasks（采集任务管理） ==========


@admin_router.get("/crawlers")
async def crawl_tasks_compat(
    status: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
):
    return await _crawl_tasks(db, status, page, pageSize)


async def _crawl_tasks(db: Session, status, page, pageSize) -> Response:
    take = pageSize or 20
    skip = ((page or 1) - 1) * take

    conditions = []
    if status:
        conditions.append(CrawlTask.status == status)
    query = db.query(CrawlTask)
    if conditions:
        query = query.filter(*conditions)
    total = query.count()
    tasks = query.order_by(CrawlTask.createdAt.desc()).offset(skip).limit(take).all()

    source_ids = list({t.sourceId for t in tasks if t.sourceId})
    source_map = {}
    if source_ids:
        for s in db.query(CrawlSource).filter(CrawlSource.id.in_(source_ids)).all():
            source_map[s.id] = s

    list_data = []
    for t in tasks:
        item = _serialize(t)
        src = source_map.get(t.sourceId) if t.sourceId else None
        item["source"] = {"name": src.name} if src else None
        list_data.append(item)

    return ok(
        {
            "list": list_data,
            "total": total,
            "page": page or 1,
            "pageSize": take,
        }
    )


@admin_router.get("/crawl/tasks")
async def crawl_tasks(
    status: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
):
    return await _crawl_tasks(db, status, page, pageSize)


def _mock_crawl_finish(task_id: int) -> None:
    """模拟异步采集完成（对应 TS setTimeout 2s 后更新任务）"""
    db = SessionLocal()
    try:
        task = db.query(CrawlTask).filter(CrawlTask.id == task_id).first()
        if task:
            task.status = "success"
            task.endAt = datetime.now()
            task.totalCount = random.randint(10, 59)
            task.newCount = random.randint(1, 20)
            db.commit()
    finally:
        db.close()


@admin_router.post("/crawl/run")
async def crawl_run(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    source_id = _num(body.get("sourceId"))
    url = body.get("url") or None
    provider = body.get("provider") or "custom"

    task = CrawlTask(
        sourceId=source_id,
        url=url,
        provider=provider,
        status="pending",
        startAt=datetime.now(),
        totalCount=0,
        newCount=0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    threading.Timer(2.0, _mock_crawl_finish, args=(task.id,)).start()
    return ok(_serialize(task))


@admin_router.post("/crawl/tasks/{task_id}/stop")
async def crawl_stop(task_id: int, db: Session = Depends(get_db)):
    task = db.query(CrawlTask).filter(CrawlTask.id == task_id).first()
    if not task:
        raise BusinessError(404, "采集任务不存在", 404)
    task.status = "failed"
    task.endAt = datetime.now()
    task.lastError = "已手动停止"
    db.commit()
    return ok(None)


# ========== Crawl Records（采集记录/审核） ==========


@admin_router.get("/crawl/records")
async def crawl_records(
    auditStatus: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
):
    take = pageSize or 20
    skip = ((page or 1) - 1) * take

    conditions = []
    if auditStatus is not None and auditStatus != "":
        conditions.append(CrawlRecord.auditStatus == int(auditStatus))
    query = db.query(CrawlRecord)
    if conditions:
        query = query.filter(*conditions)
    total = query.count()
    records = query.order_by(CrawlRecord.createdAt.desc()).offset(skip).limit(take).all()

    task_ids = list({r.taskId for r in records})
    task_map = {}
    if task_ids:
        for t in db.query(CrawlTask).filter(CrawlTask.id.in_(task_ids)).all():
            task_map[t.id] = t

    list_data = []
    for r in records:
        item = _serialize(r)
        t = task_map.get(r.taskId)
        item["task"] = (
            {"provider": t.provider, "sourceId": t.sourceId} if t else None
        )
        list_data.append(item)

    return ok(
        {
            "list": list_data,
            "total": total,
            "page": page or 1,
            "pageSize": take,
        }
    )


@admin_router.post("/crawl/audit")
async def crawl_audit(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    ids = body.get("ids") or []
    audit_status = body.get("auditStatus")
    audit_reason = body.get("auditReason")

    update_data = {"auditBy": "admin", "auditAt": datetime.now()}
    if audit_status is not None:
        update_data["auditStatus"] = int(audit_status)
    if audit_reason is not None:
        update_data["auditReason"] = audit_reason

    if ids:
        db.query(CrawlRecord).filter(CrawlRecord.id.in_(ids)).update(
            update_data, synchronize_session=False
        )
        db.commit()
    return ok(None)


# ========== Crawl Import（批量导入） ==========


def _run_github_import(
    task_id: int,
    source_id: int,
    raw_url: str,
    source_name: str,
    compliance_tag,
    protocol,
    dataset_type,
    category_type,
    provider,
) -> None:
    """后台线程执行 GitHub 导入（独立 session），对应 TS 里的异步 IIFE"""
    db = SessionLocal()
    try:
        result = import_from_github_raw(
            db,
            {
                "rawUrl": raw_url,
                "taskId": task_id,
                "sourceId": source_id,
                "sourceName": source_name,
                "complianceTag": compliance_tag,
                "protocol": protocol,
                "datasetType": dataset_type,
                "categoryType": category_type,
                "provider": provider,
            },
        )
        errors = result.get("errors") or []
        total_inserted = result.get("totalInserted", 0)

        task = db.query(CrawlTask).filter(CrawlTask.id == task_id).first()
        if task:
            task.status = "failed" if errors and total_inserted == 0 else "success"
            task.endAt = datetime.now()
            task.totalCount = result.get("totalFetched", 0)
            task.newCount = total_inserted
            task.recordCount = total_inserted
            if errors:
                task.lastError = "; ".join(errors[:3])
            else:
                skipped = result.get("totalSkipped", 0)
                reason = result.get("skippedReason") or {}
                task.lastError = (
                    f"去重跳过 {skipped} 条 "
                    f"(MD5={reason.get('md5', 0)}, SimHash={reason.get('simhash', 0)})"
                )
            task.errorMessage = "\n".join(errors)[:2000]
            db.commit()

        src = db.query(CrawlSource).filter(CrawlSource.id == source_id).first()
        if src:
            src.lastRunAt = datetime.now()
            src.lastCrawlAt = datetime.now()
            src.totalCrawled = (src.totalCrawled or 0) + total_inserted
            db.commit()
    except Exception as err:
        db.rollback()
        task = db.query(CrawlTask).filter(CrawlTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.endAt = datetime.now()
            task.lastError = str(err)[:500]
            task.errorMessage = str(err)[:2000]
            db.commit()
    finally:
        db.close()


@admin_router.post("/crawl/import")
async def crawl_import(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    source_id = body.get("sourceId")
    if not source_id:
        raise BusinessError(400, "sourceId 不能为空")
    source_id = int(source_id)

    source = db.query(CrawlSource).filter(CrawlSource.id == source_id).first()
    if not source:
        raise BusinessError(404, "采集源不存在", 404)
    if source.type != "github":
        raise BusinessError(400, "仅支持 GitHub 直导入类型的采集源")

    raw_url = resolve_github_raw_url(source.remark, source.baseUrl)
    if not raw_url:
        raise BusinessError(
            400,
            "采集源 remark/baseUrl 未配置为有效的 GitHub raw URL。"
            "remark 需填完整 URL 或 owner/repo/branch/path 格式（不含中文备注）",
        )
    if not re.search(r"\.json(?:$|\?)", raw_url, re.IGNORECASE):
        raise BusinessError(
            400, f"GitHub 采集源必须指向 .json 文件，当前解析到: {raw_url}"
        )
    try:
        parsed = urlparse(raw_url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("not http(s)")
    except Exception:
        raise BusinessError(400, f"解析后的 URL 无效: {raw_url}")

    task = CrawlTask(
        sourceId=source_id,
        url=raw_url,
        provider=source.code,
        status="running",
        priority=source.priority,
        totalCount=0,
        newCount=0,
        startAt=datetime.now(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 立即返回，后台异步处理（大量数据导入耗时较长）
    payload = {"code": 0, "message": "已开始导入", "data": {"taskId": task.id, "status": "running"}}
    threading.Thread(
        target=_run_github_import,
        args=(
            task.id,
            source_id,
            raw_url,
            source.name,
            source.complianceTag,
            source.protocol,
            source.datasetType,
            source.categoryType,
            source.code,
        ),
        daemon=True,
    ).start()

    return Response(
        content=json.dumps(payload, ensure_ascii=False),
        status_code=202,
        media_type="application/json",
    )


@admin_router.get("/crawl/source-stats")
async def crawl_source_stats(db: Session = Depends(get_db)):
    def count_cs(**kw):
        return db.query(CrawlSource).filter_by(**kw).count()

    return ok(
        {
            "total": db.query(CrawlSource).count(),
            "githubCount": count_cs(type="github"),
            "publicDomainCount": count_cs(complianceTag="public_domain"),
            "apiCount": count_cs(type="api"),
            "mitCount": count_cs(complianceTag="mit"),
            "cc0Count": count_cs(complianceTag="cc0"),
            "apacheCount": count_cs(complianceTag="apache"),
            "ccBySaCount": count_cs(complianceTag="cc_by_sa"),
            "pendingCrawl": db.query(CrawlTask).filter(CrawlTask.status == "pending").count(),
            "runningCrawl": db.query(CrawlTask).filter(CrawlTask.status == "running").count(),
        }
    )


@admin_router.get("/crawl/sources/{source_id}/check")
async def crawl_source_check(source_id: int, db: Session = Depends(get_db)):
    source = db.query(CrawlSource).filter(CrawlSource.id == source_id).first()
    if not source:
        raise BusinessError(404, "采集源不存在", 404)
    if source.type != "github":
        raise BusinessError(400, "仅支持 GitHub 类型采集源的连通性预检")

    raw_url = resolve_github_raw_url(source.remark, source.baseUrl)
    if not raw_url:
        return ok(
            {
                "sourceId": source_id,
                "ok": False,
                "status": 0,
                "statusText": "URL 解析失败：remark 需填完整 URL 或 owner/repo/branch/path 格式",
                "url": None,
                "latencyMs": 0,
            }
        )

    result = check_url_reachable(raw_url)
    if not result["ok"]:
        # 检测失败时 touch 一下 source，便于列表展示最新状态
        src = db.query(CrawlSource).filter(CrawlSource.id == source_id).first()
        if src:
            src.updatedAt = datetime.now()
            db.commit()

    return ok({"sourceId": source_id, **result})


@admin_router.get("/crawl/sources-check-all")
async def crawl_source_check_all(db: Session = Depends(get_db)):
    sources = (
        db.query(CrawlSource)
        .filter(CrawlSource.type == "github", CrawlSource.status == 1)
        .order_by(CrawlSource.id.asc())
        .all()
    )

    results = []
    for s in sources:
        raw_url = resolve_github_raw_url(s.remark, s.baseUrl)
        if not raw_url:
            results.append(
                {
                    "sourceId": s.id,
                    "code": s.code,
                    "name": s.name,
                    "ok": False,
                    "status": 0,
                    "statusText": "URL 解析失败",
                    "url": "",
                    "latencyMs": 0,
                }
            )
            continue
        r = check_url_reachable(raw_url)
        results.append(
            {
                "sourceId": s.id,
                "code": s.code,
                "name": s.name,
                "ok": r["ok"],
                "status": r["status"],
                "statusText": r["statusText"],
                "url": r["url"],
                "latencyMs": r["latencyMs"],
            }
        )

    ok_count = sum(1 for r in results if r["ok"])
    return ok(
        {
            "total": len(results),
            "ok": ok_count,
            "fail": len(results) - ok_count,
            "results": results,
        }
    )


# ========== Crawl Schedule（采集调度） ==========


@admin_router.get("/crawl/schedule")
async def crawl_schedule(db: Session = Depends(get_db)):
    rows = db.query(CrawlSchedule).all()
    return ok([_serialize(r) for r in rows])


@admin_router.post("/crawl/schedule")
async def crawl_schedule_create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    source_id = body.get("sourceId")
    cron_expr = body.get("cronExpr")
    if not source_id or not cron_expr:
        raise BusinessError(400, "采集源和Cron表达式不能为空")

    item = CrawlSchedule(
        sourceId=int(source_id),
        cronExpr=cron_expr,
        enabled=body.get("enabled", 1),
        concurrency=body.get("concurrency", 2),
        pagesPerRun=body.get("pagesPerRun", 20),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.put("/crawl/schedule/{schedule_id}")
async def crawl_schedule_update(schedule_id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    item = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
    if not item:
        raise BusinessError(404, "调度配置不存在", 404)

    for field in ("cronExpr", "enabled", "concurrency", "pagesPerRun"):
        if body.get(field) is not None:
            setattr(item, field, body[field])
    db.commit()
    db.refresh(item)
    return ok(_serialize(item))


@admin_router.delete("/crawl/schedule/{schedule_id}")
async def crawl_schedule_delete(schedule_id: int, db: Session = Depends(get_db)):
    item = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
    if not item:
        raise BusinessError(404, "调度配置不存在", 404)
    db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).delete()
    db.commit()
    return ok(None)


@admin_router.post("/crawl/schedule/{schedule_id}/enable")
async def crawl_schedule_enable(schedule_id: int, db: Session = Depends(get_db)):
    item = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
    if not item:
        raise BusinessError(404, "调度配置不存在", 404)
    item.enabled = 1
    db.commit()
    try:
        cron_scheduler.register(item.id)
    except Exception as e:
        raise BusinessError(500, f"调度器加载失败: {e}", 500)
    return ok(_serialize(item))


@admin_router.post("/crawl/schedule/{schedule_id}/disable")
async def crawl_schedule_disable(schedule_id: int, db: Session = Depends(get_db)):
    item = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
    if not item:
        raise BusinessError(404, "调度配置不存在", 404)
    item.enabled = 0
    db.commit()
    try:
        cron_scheduler.unregister(schedule_id)
    except Exception:
        pass
    return ok(_serialize(item))


@admin_router.post("/crawl/schedule/{schedule_id}/trigger")
async def crawl_schedule_trigger(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
    if not schedule:
        raise BusinessError(404, "调度配置不存在", 404)
    try:
        cron_scheduler.trigger_now(schedule_id)
        return ok({"triggered": True, "scheduleId": schedule_id})
    except Exception as e:
        raise BusinessError(500, f"触发失败: {e}", 500)


# ========== OriginalText / Quote 审核 ==========


@admin_router.get("/audit/pending-stats")
async def pending_audit_stats(db: Session = Depends(get_db)):
    original_count = (
        db.query(OriginalText).filter(OriginalText.auditStatus == 0).count()
    )
    quote_count = db.query(Quote).filter(Quote.auditStatus == 0).count()
    return ok({"originalCount": original_count, "quoteCount": quote_count})


@admin_router.post("/audit/original-texts")
async def audit_original_text(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    ids = body.get("ids")
    audit_status = body.get("auditStatus")
    audit_reason = body.get("auditReason")

    if not isinstance(ids, list) or len(ids) == 0:
        raise BusinessError(400, "请选择要审核的原文")
    if audit_status not in (1, 2):
        raise BusinessError(400, "审核状态无效（1=通过 2=拒绝）")

    numeric_ids = [int(i) for i in ids if _is_number(i)]
    if not numeric_ids:
        raise BusinessError(400, "ID列表无效")

    result = (
        db.query(OriginalText)
        .filter(OriginalText.id.in_(numeric_ids))
        .update(
            {"auditStatus": audit_status, "auditReason": audit_reason or None},
            synchronize_session=False,
        )
    )
    db.commit()
    return ok({"updated": result})


@admin_router.post("/audit/quotes")
async def audit_quote(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    ids = body.get("ids")
    audit_status = body.get("auditStatus")
    audit_reason = body.get("auditReason")

    if not isinstance(ids, list) or len(ids) == 0:
        raise BusinessError(400, "请选择要审核的金句")
    if audit_status not in (1, 2):
        raise BusinessError(400, "审核状态无效（1=通过 2=拒绝）")

    numeric_ids = [int(i) for i in ids if _is_number(i)]
    if not numeric_ids:
        raise BusinessError(400, "ID列表无效")

    result = (
        db.query(Quote)
        .filter(Quote.id.in_(numeric_ids))
        .update(
            {"auditStatus": audit_status, "auditReason": audit_reason or None},
            synchronize_session=False,
        )
    )
    db.commit()
    return ok({"updated": result})


# ========== OriginalText Admin（原文管理） ==========


@admin_router.get("/original-texts")
async def original_text_admin_list(
    keyword: str | None = None,
    categoryType: str | None = None,
    auditStatus: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
):
    take = pageSize or 20
    skip = ((page or 1) - 1) * take

    conditions = []
    if keyword:
        conditions.append(
            or_(
                OriginalText.title.contains(keyword),
                OriginalText.content.contains(keyword),
                OriginalText.author.contains(keyword),
            )
        )
    if categoryType:
        conditions.append(OriginalText.categoryType == categoryType)
    if auditStatus is not None and auditStatus != "":
        conditions.append(OriginalText.auditStatus == int(auditStatus))

    query = db.query(OriginalText)
    if conditions:
        query = query.filter(*conditions)
    total = query.count()
    records = (
        query.order_by(OriginalText.createdAt.desc()).offset(skip).limit(take).all()
    )

    ot_ids = [r.id for r in records]
    quote_map = {}
    if ot_ids:
        quotes = (
            db.query(Quote)
            .filter(Quote.originalTextId.in_(ot_ids))
            .order_by(Quote.id.asc())
            .all()
        )
        for q in quotes:
            quote_map.setdefault(q.originalTextId, []).append(_serialize(q))

    list_data = []
    for r in records:
        item = _serialize(r)
        item["quotes"] = quote_map.get(r.id, [])
        list_data.append(item)

    return ok(
        {
            "list": list_data,
            "total": total,
            "page": page or 1,
            "pageSize": take,
        }
    )


@admin_router.get("/original-texts/{original_text_id}")
async def original_text_admin_detail(original_text_id: int, db: Session = Depends(get_db)):
    item = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
    if not item:
        raise BusinessError(404, "原文不存在", 404)
    data = _serialize(item)
    quotes = (
        db.query(Quote)
        .filter(Quote.originalTextId == original_text_id)
        .order_by(Quote.id.asc())
        .all()
    )
    data["quotes"] = [_serialize(q) for q in quotes]
    return ok(data)
