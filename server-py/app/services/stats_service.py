"""统计服务（对应 TS stats_service.ts）"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..models import (
    Category,
    Collection,
    CollectionQuote,
    CompositionTemplate,
    DailyRecommend,
    DailyRecommendQuote,
    Order,
    Quote,
    ReciteLog,
    RecitePlan,
    User,
)


def _startOfDay(d: datetime) -> datetime:
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


def dashboard(db: Session) -> dict:
    startOfToday = _startOfDay(datetime.now())

    totalUsers = db.query(User).count()
    todayNewUsers = db.query(User).filter(User.createdAt >= startOfToday).count()
    totalQuotes = db.query(Quote).filter(Quote.isActive == True, Quote.auditStatus == 1).count()
    freeQuotes = (
        db.query(Quote).filter(Quote.isActive == True, Quote.auditStatus == 1, Quote.isFree == True).count()
    )
    memberOnlyQuotes = (
        db.query(Quote).filter(Quote.isActive == True, Quote.auditStatus == 1, Quote.isFree == False).count()
    )
    totalCollections = db.query(Collection).count()
    totalCollectionQuotes = db.query(CollectionQuote).count()
    newOrders = db.query(Order).filter(Order.createdAt >= startOfToday).count()
    newCollections = db.query(Collection).filter(Collection.createdAt >= startOfToday).count()
    newRecitePlans = db.query(RecitePlan).filter(RecitePlan.createdAt >= startOfToday).count()
    reviews = db.query(ReciteLog).filter(ReciteLog.reviewDate >= startOfToday).count()

    return {
        "users": {"total": totalUsers, "todayNew": todayNewUsers},
        "quotes": {
            "total": totalQuotes,
            "free": freeQuotes,
            "memberOnly": memberOnlyQuotes,
        },
        "collections": {
            "total": totalCollections,
            "quotes": totalCollectionQuotes,
        },
        "todayActivity": {
            "newOrders": newOrders,
            "newCollections": newCollections,
            "newRecitePlans": newRecitePlans,
            "reviews": reviews,
        },
    }


def homeStats(db: Session) -> dict:
    today = _startOfDay(datetime.now())
    tomorrow = today + timedelta(days=1)

    quoteTotal = db.query(Quote).filter(Quote.isActive == True, Quote.auditStatus == 1).count()
    categoryTotal = db.query(Category).filter(Category.status == 1).count()
    templateTotal = db.query(CompositionTemplate).filter(CompositionTemplate.status == 1).count()
    dailyCount = (
        db.query(DailyRecommendQuote)
        .join(DailyRecommend, DailyRecommendQuote.recommendId == DailyRecommend.id)
        .filter(
            DailyRecommend.recommendDate >= today,
            DailyRecommend.recommendDate < tomorrow,
        )
        .count()
    )

    return {
        "quoteTotal": quoteTotal,
        "categoryTotal": categoryTotal,
        "templateTotal": templateTotal,
        "dailyRecommendCount": dailyCount,
    }
