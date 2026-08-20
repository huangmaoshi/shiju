"""每日推荐服务

对应 TypeScript 版 server/src/services/daily_recommend_service.ts
"""
import random as _random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import DailyRecommend, DailyRecommendQuote, Quote, QuoteCategory, Category


def _start_of_day(d: datetime) -> datetime:
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


def _format_date(d: datetime) -> str:
    return f"{d.year}-{d.month:02d}-{d.day:02d}"


def _get_quote_categories(db: Session, quote_id: int) -> list:
    qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).all()
    if not qcs:
        return []
    cat_ids = [qc.categoryId for qc in qcs]
    cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
    return [{"id": str(c.id), "name": c.name, "type": c.type} for c in cats]


def _to_daily_recommend_item(db: Session, record: DailyRecommend, rq_records: list) -> dict:
    quotes: list = []
    for rq in rq_records:
        q = db.query(Quote).filter(Quote.id == rq.quoteId).first()
        if not q:
            continue
        categories = _get_quote_categories(db, q.id)
        quotes.append({
            "id": str(q.id),
            "content": q.content,
            "author": q.author or None,
            "source": q.source or None,
            "summary": q.summary or None,
            "isFree": q.isFree,
            "categories": categories,
            "wordCount": q.wordCount,
            "isLongText": q.wordCount > 100,
            "pinyinData": q.pinyinData or None,
            "collected": False,
            "inRecitePlan": False,
        })

    return {
        "id": record.id,
        "recommendDate": _format_date(record.recommendDate),
        "theme": record.theme or None,
        "quotes": quotes,
    }


def _load_with_quotes(db: Session, record: DailyRecommend) -> list:
    return (
        db.query(DailyRecommendQuote)
        .filter(DailyRecommendQuote.recommendId == record.id)
        .order_by(DailyRecommendQuote.sort.asc())
        .all()
    )


def getToday(db: Session) -> dict:
    today = _start_of_day(datetime.now())

    record = db.query(DailyRecommend).filter(DailyRecommend.recommendDate == today).first()
    if not record:
        record = _generate_today_recommend(db, today)

    rq_records = _load_with_quotes(db, record)
    return _to_daily_recommend_item(db, record, rq_records)


def getByDate(db: Session, date: str) -> dict | None:
    try:
        d = datetime.fromisoformat(date)
        if d.hour == 0 and d.minute == 0 and d.second == 0:
            pass  # already a date-only
    except (ValueError, TypeError):
        try:
            d = datetime.fromisoformat(date + "T00:00:00")
        except (ValueError, TypeError):
            raise BusinessError(400, "日期格式无效")

    d = _start_of_day(d)
    record = db.query(DailyRecommend).filter(DailyRecommend.recommendDate == d).first()
    if not record:
        return None

    rq_records = _load_with_quotes(db, record)
    return _to_daily_recommend_item(db, record, rq_records)


def _generate_today_recommend(db: Session, today: datetime) -> DailyRecommend:
    all_quotes = db.query(Quote).filter(
        Quote.isActive == True,
        Quote.auditStatus == 1,
    ).with_entities(Quote.id).all()

    if not all_quotes:
        raise BusinessError(500, "暂无可推荐的名句", 500)

    pool = [q[0] for q in all_quotes]
    take_count = min(10, len(pool))
    quote_ids: list[int] = []
    for _ in range(take_count):
        idx = _random.randint(0, len(pool) - 1)
        quote_ids.append(pool.pop(idx))

    record = DailyRecommend(
        recommendDate=today,
        theme="今日精选",
        status=1,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    for idx, qid in enumerate(quote_ids):
        rq = DailyRecommendQuote(
            recommendId=record.id,
            quoteId=qid,
            sort=idx,
        )
        db.add(rq)
    db.commit()

    return record
