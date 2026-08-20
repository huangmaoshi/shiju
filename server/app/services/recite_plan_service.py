"""背诵计划服务

对应 TypeScript 版 server/src/services/recite_plan_service.ts
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..deps import BusinessError
from ..models import RecitePlan, ReciteLog

EBBINGHAUS = [1, 2, 4, 7, 15, 30, 60]


def _format_date(d: datetime) -> str:
    return f"{d.year}-{d.month:02d}-{d.day:02d}"


def _start_of_day(d: datetime) -> datetime:
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


def _to_plan_item(p: RecitePlan) -> dict:
    return {
        "id": p.id,
        "userId": p.userId,
        "quoteId": p.quoteId or None,
        "customQuoteId": p.customQuoteId or None,
        "currentStage": p.currentStage,
        "nextReviewAt": p.nextReviewAt.isoformat() if p.nextReviewAt else None,
        "lastReviewAt": p.lastReviewAt.isoformat() if p.lastReviewAt else None,
        "masterLevel": p.masterLevel,
        "createdAt": p.createdAt.isoformat() if p.createdAt else None,
    }


def list(db: Session, userId: int) -> list:
    plans = (
        db.query(RecitePlan)
        .filter(RecitePlan.userId == userId)
        .order_by(RecitePlan.nextReviewAt.asc())
        .all()
    )
    return [_to_plan_item(p) for p in plans]


def add(db: Session, userId: int, input_data: dict) -> dict:
    quote_id = input_data.get("quoteId")
    custom_quote_id = input_data.get("customQuoteId")

    if not quote_id and not custom_quote_id:
        raise BusinessError(400, "quoteId 或 customQuoteId 不能同时为空")

    existing = db.query(RecitePlan).filter(
        RecitePlan.userId == userId,
        RecitePlan.quoteId == quote_id if quote_id else RecitePlan.quoteId.is_(None),
        RecitePlan.customQuoteId == custom_quote_id if custom_quote_id else RecitePlan.customQuoteId.is_(None),
    ).first()

    if existing:
        return _to_plan_item(existing)

    next_review_at = datetime.now() + timedelta(days=EBBINGHAUS[0])

    plan = RecitePlan(
        userId=userId,
        quoteId=quote_id,
        customQuoteId=custom_quote_id,
        currentStage=0,
        nextReviewAt=next_review_at,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    return _to_plan_item(plan)


def todayReview(db: Session, userId: int) -> list:
    now = datetime.now()
    plans = (
        db.query(RecitePlan)
        .filter(RecitePlan.userId == userId, RecitePlan.nextReviewAt <= now)
        .order_by(RecitePlan.nextReviewAt.asc())
        .all()
    )
    return [_to_plan_item(p) for p in plans]


def review(db: Session, planId: int, userId: int, action: str) -> dict:
    plan = db.query(RecitePlan).filter(RecitePlan.id == planId).first()
    if not plan:
        raise BusinessError(404, "背诵计划不存在", 404)
    if plan.userId != userId:
        raise BusinessError(403, "无权操作", 403)

    new_stage = plan.currentStage
    master_level = plan.masterLevel

    if action == "master":
        new_stage = min(plan.currentStage + 1, len(EBBINGHAUS) - 1)
        master_level = min(master_level + 1, len(EBBINGHAUS))
    elif action == "not_skilled":
        new_stage = max(plan.currentStage - 1, 0)

    now = datetime.now()
    days = EBBINGHAUS[new_stage] if new_stage < len(EBBINGHAUS) else EBBINGHAUS[-1]
    next_review_at = now + timedelta(days=days)

    try:
        plan.currentStage = new_stage
        plan.lastReviewAt = now
        plan.nextReviewAt = next_review_at
        plan.masterLevel = master_level

        log = ReciteLog(
            userId=userId,
            planId=planId,
            action=action,
            reviewDate=now,
        )
        db.add(log)
        db.commit()
        db.refresh(plan)
    except Exception:
        db.rollback()
        raise

    return _to_plan_item(plan)


def stats(db: Session, userId: int) -> dict:
    now = datetime.now()
    today_start = _start_of_day(now)

    total = db.query(RecitePlan).filter(RecitePlan.userId == userId).count()

    today_count = (
        db.query(ReciteLog)
        .filter(ReciteLog.userId == userId, ReciteLog.reviewDate >= today_start)
        .count()
    )

    mastered_count = (
        db.query(RecitePlan)
        .filter(RecitePlan.userId == userId, RecitePlan.masterLevel >= len(EBBINGHAUS) - 1)
        .count()
    )

    logs = db.query(ReciteLog.reviewDate).filter(ReciteLog.userId == userId).all()

    calendar: dict[str, int] = {}
    for log in logs:
        key = _format_date(log[0])
        calendar[key] = calendar.get(key, 0) + 1

    return {
        "total": total,
        "todayCount": today_count,
        "masteredCount": mastered_count,
        "calendar": calendar,
    }
