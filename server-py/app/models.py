"""拾句后端 Python 版 - SQLAlchemy 数据模型

对应 TypeScript 版 server/prisma/schema.prisma（SQLite 版）
表名与列名保持 Prisma 默认命名（camelCase），便于与原有数据库兼容。
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from .database import Base


class User(Base):
    __tablename__ = "User"

    id = Column(Integer, primary_key=True, autoincrement=True)
    openId = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, nullable=True)
    passwordHash = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    gender = Column(Integer, default=0)
    userType = Column(String, default="wechat")  # wechat / account / admin
    memberLevel = Column(Integer, default=0)
    memberExpireAt = Column(DateTime, nullable=True)
    trialExpireAt = Column(DateTime, nullable=True)
    status = Column(Integer, default=1)
    lastLoginAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Member(Base):
    __tablename__ = "Member"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), unique=True, nullable=False)
    planType = Column(String, default="monthly")
    startDate = Column(DateTime, default=datetime.now)
    expireDate = Column(DateTime, nullable=False)
    status = Column(Integer, default=1)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Order(Base):
    __tablename__ = "Order"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), nullable=False)
    orderNo = Column(String, unique=True, nullable=False)
    planType = Column(String, nullable=False)
    amount = Column(Float, default=0)
    payChannel = Column(String, default="wechat")
    payStatus = Column(Integer, default=0)
    payTime = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("Order_userId_idx", "userId"),)


class Category(Base):
    __tablename__ = "Category"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    parentId = Column(Integer, ForeignKey("Category.id"), nullable=True)
    sort = Column(Integer, default=0)
    status = Column(Integer, default=1)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("Category_type_idx", "type"),)


class QuoteCategory(Base):
    __tablename__ = "QuoteCategory"

    quoteId = Column(Integer, ForeignKey("Quote.id"), primary_key=True)
    categoryId = Column(Integer, ForeignKey("Category.id"), primary_key=True)

    __table_args__ = (Index("QuoteCategory_categoryId_idx", "categoryId"),)


class OriginalTextCategory(Base):
    __tablename__ = "OriginalTextCategory"

    originalTextId = Column(Integer, ForeignKey("OriginalText.id"), primary_key=True)
    categoryId = Column(Integer, ForeignKey("Category.id"), primary_key=True)

    __table_args__ = (Index("OriginalTextCategory_categoryId_idx", "categoryId"),)


class Quote(Base):
    __tablename__ = "Quote"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content = Column(Text, nullable=False)
    contentMd5 = Column(String, nullable=True)
    simHash = Column(String, nullable=True)
    author = Column(String, nullable=True)
    source = Column(String, nullable=True)
    sourceUrl = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    pinyinData = Column(Text, nullable=True)
    simplifiedContent = Column(Text, nullable=True)
    tags = Column(String, nullable=True)
    wordCount = Column(Integer, default=0)
    isFree = Column(Boolean, default=True)
    isActive = Column(Boolean, default=True)
    auditStatus = Column(Integer, default=1)  # 0=待审 1=通过 2=拒绝
    auditReason = Column(String, nullable=True)
    viewCount = Column(Integer, default=0)
    favCount = Column(Integer, default=0)
    originalTextId = Column(Integer, ForeignKey("OriginalText.id"), nullable=True)
    quoteType = Column(String, default="admin")  # admin / crawl / ai / user
    aiExtracted = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("Quote_originalTextId_idx", "originalTextId"),
        Index("Quote_contentMd5_idx", "contentMd5"),
        Index("Quote_quoteType_idx", "quoteType"),
        Index("Quote_auditStatus_idx", "auditStatus"),
    )


class CustomQuote(Base):
    __tablename__ = "CustomQuote"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=True)
    source = Column(String, nullable=True)
    note = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    categoryIds = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (Index("CustomQuote_userId_idx", "userId"),)


class Collection(Base):
    __tablename__ = "Collection"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    isDefault = Column(Integer, default=0)
    quoteCount = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (Index("Collection_userId_idx", "userId"),)


class CollectionQuote(Base):
    __tablename__ = "CollectionQuote"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collectionId = Column(Integer, ForeignKey("Collection.id", ondelete="CASCADE"), nullable=False)
    quoteId = Column(Integer, ForeignKey("Quote.id"), nullable=True)
    customQuoteId = Column(Integer, ForeignKey("CustomQuote.id"), nullable=True)
    addedAt = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("CollectionQuote_collectionId_idx", "collectionId"),
        Index("CollectionQuote_quoteId_idx", "quoteId"),
    )


class RecitePlan(Base):
    __tablename__ = "RecitePlan"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), nullable=False)
    quoteId = Column(Integer, nullable=True)
    customQuoteId = Column(Integer, nullable=True)
    currentStage = Column(Integer, default=0)
    nextReviewAt = Column(DateTime, nullable=False)
    lastReviewAt = Column(DateTime, nullable=True)
    masterLevel = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("RecitePlan_userId_idx", "userId"),)


class ReciteLog(Base):
    __tablename__ = "ReciteLog"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), nullable=False)
    planId = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    reviewDate = Column(DateTime, nullable=False)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("ReciteLog_userId_idx", "userId"),)


class DailyRecommend(Base):
    __tablename__ = "DailyRecommend"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recommendDate = Column(DateTime, unique=True, nullable=False)
    theme = Column(String, nullable=True)
    status = Column(Integer, default=1)
    createdAt = Column(DateTime, default=datetime.now)


class DailyRecommendQuote(Base):
    __tablename__ = "DailyRecommendQuote"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recommendId = Column(Integer, ForeignKey("DailyRecommend.id"), nullable=False)
    quoteId = Column(Integer, ForeignKey("Quote.id"), nullable=False)
    sort = Column(Integer, default=0)


class CardTemplate(Base):
    __tablename__ = "CardTemplate"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    style = Column(String, nullable=False)
    bgType = Column(String, nullable=False)
    bgValue = Column(String, nullable=False)
    fontFamily = Column(String, nullable=False)
    fontSize = Column(Integer, default=18)
    fontColor = Column(String, nullable=False)
    lineHeight = Column(Float, default=1.8)
    textAlign = Column(String, default="center")
    showAuthor = Column(Integer, default=1)
    showWatermark = Column(Integer, default=1)
    isMember = Column(Integer, default=0)
    status = Column(Integer, default=1)
    previewUrl = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("CardTemplate_isMember_status_idx", "isMember", "status"),)


class CompositionTemplate(Base):
    __tablename__ = "CompositionTemplate"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    examples = Column(Text, nullable=True)
    theme = Column(String, nullable=True)
    isFree = Column(Integer, default=1)
    status = Column(Integer, default=1)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("CompositionTemplate_type_status_idx", "type", "status"),)


class ThemePackage(Base):
    __tablename__ = "ThemePackage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    coverUrl = Column(String, nullable=True)
    quoteIds = Column(Text, nullable=False)
    isMember = Column(Integer, default=0)
    adUnlockDays = Column(Integer, default=7)
    expireDate = Column(DateTime, nullable=True)
    status = Column(Integer, default=1)
    createdAt = Column(DateTime, default=datetime.now)


class AdConfig(Base):
    __tablename__ = "AdConfig"

    id = Column(Integer, primary_key=True, autoincrement=True)
    position = Column(String, nullable=False)
    title = Column(String, nullable=True)
    imageUrl = Column(String, nullable=True)
    targetUrl = Column(String, nullable=True)
    adType = Column(String, nullable=True)
    adUnitId = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    frequency = Column(Integer, default=3)
    priority = Column(Integer, default=0)
    isActive = Column(Boolean, default=True)
    status = Column(Integer, default=1)
    startAt = Column(DateTime, nullable=True)
    endAt = Column(DateTime, nullable=True)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (Index("AdConfig_position_status_idx", "position", "status"),)


class SyncRecord(Base):
    __tablename__ = "SyncRecord"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, ForeignKey("User.id"), nullable=False)
    tableName = Column(String, nullable=False)
    recordId = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    syncAt = Column(DateTime, default=datetime.now)
    deviceId = Column(String, nullable=True)

    __table_args__ = (Index("SyncRecord_userId_syncAt_idx", "userId", "syncAt"),)


class SearchHistory(Base):
    __tablename__ = "SearchHistory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    userId = Column(Integer, nullable=False)
    keyword = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (Index("SearchHistory_userId_createdAt_idx", "userId", "createdAt"),)


class CrawlSource(Base):
    __tablename__ = "CrawlSource"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    baseUrl = Column(String, nullable=False)
    type = Column(String, nullable=False)  # static / dynamic / github / api / file
    datasetType = Column(String, nullable=True)  # poetry / prose / quote / lyric / script
    complianceTag = Column(String, nullable=True)
    protocol = Column(String, nullable=True)
    datasetSize = Column(Integer, nullable=True)
    needTranslate = Column(Boolean, default=False)
    categoryType = Column(String, nullable=True)
    categoryId = Column(Integer, nullable=True)
    charset = Column(String, default="utf-8")
    userAgent = Column(String, nullable=True)
    qpsLimit = Column(Integer, default=5)
    maxDepth = Column(Integer, default=3)
    status = Column(Integer, default=1)
    priority = Column(Integer, default=0)
    remark = Column(String, nullable=True)
    lastRunAt = Column(DateTime, nullable=True)
    lastCrawlAt = Column(DateTime, nullable=True)
    totalCrawled = Column(Integer, default=0)
    successRate = Column(Float, default=0)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("CrawlSource_status_idx", "status"),
        Index("CrawlSource_complianceTag_idx", "complianceTag"),
        Index("CrawlSource_type_idx", "type"),
    )


class CrawlTask(Base):
    __tablename__ = "CrawlTask"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sourceId = Column(Integer, ForeignKey("CrawlSource.id"), nullable=True)
    url = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    depth = Column(Integer, default=1)
    method = Column(String, default="GET")
    selector = Column(String, nullable=True)
    interval = Column(Integer, default=0)
    status = Column(String, default="pending")  # pending / running / success / failed
    priority = Column(Integer, default=0)
    retryCount = Column(Integer, default=0)
    maxRetry = Column(Integer, default=3)
    nextRunAt = Column(DateTime, nullable=True)
    startAt = Column(DateTime, nullable=True)
    endAt = Column(DateTime, nullable=True)
    lastRunAt = Column(DateTime, nullable=True)
    lastError = Column(String, nullable=True)
    errorMessage = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)
    totalCount = Column(Integer, default=0)
    newCount = Column(Integer, default=0)
    recordCount = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("CrawlTask_sourceId_status_idx", "sourceId", "status"),
        Index("CrawlTask_status_idx", "status"),
    )


class CrawlRecord(Base):
    __tablename__ = "CrawlRecord"

    id = Column(Integer, primary_key=True, autoincrement=True)
    taskId = Column(Integer, ForeignKey("CrawlTask.id"), nullable=False)
    sourceId = Column(Integer, ForeignKey("CrawlSource.id"), nullable=False)
    originalUrl = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=True)
    sourceName = Column(String, nullable=True)
    rawHtml = Column(Text, nullable=True)
    extractMethod = Column(String, nullable=True)
    simHash = Column(String, nullable=True)
    fingerprint = Column(String, nullable=True)
    categoryType = Column(String, nullable=True)
    categoryIds = Column(String, nullable=True)
    auditStatus = Column(Integer, default=0)  # 0=待审 1=通过 2=拒绝 3=重复
    auditReason = Column(String, nullable=True)
    auditBy = Column(String, nullable=True)
    auditAt = Column(DateTime, nullable=True)
    finalQuoteId = Column(Integer, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("CrawlRecord_taskId_idx", "taskId"),
        Index("CrawlRecord_fingerprint_idx", "fingerprint"),
        Index("CrawlRecord_auditStatus_idx", "auditStatus"),
    )


class CrawlSchedule(Base):
    __tablename__ = "CrawlSchedule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sourceId = Column(Integer, ForeignKey("CrawlSource.id"), unique=True, nullable=False)
    cronExpr = Column(String, nullable=False)
    enabled = Column(Integer, default=1)
    concurrency = Column(Integer, default=2)
    pagesPerRun = Column(Integer, default=20)
    nextRunAt = Column(DateTime, nullable=True)
    lastRunAt = Column(DateTime, nullable=True)
    lastRunStatus = Column(String, nullable=True)
    lastRunCount = Column(Integer, default=0)
    lastError = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OriginalText(Base):
    __tablename__ = "OriginalText"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    contentMd5 = Column(String, nullable=True)
    simHash = Column(String, nullable=True)
    author = Column(String, nullable=True)
    source = Column(String, nullable=True)
    sourceUrl = Column(String, nullable=True)
    categoryType = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    pinyinData = Column(Text, nullable=True)
    simplifiedContent = Column(Text, nullable=True)
    summary = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    wordCount = Column(Integer, default=0)
    provider = Column(String, nullable=True)
    complianceTag = Column(String, nullable=True)
    protocol = Column(String, nullable=True)
    status = Column(Integer, default=1)
    auditStatus = Column(Integer, default=1)  # 0=待审 1=通过 2=拒绝
    auditReason = Column(String, nullable=True)
    quoteCount = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("OriginalText_categoryType_idx", "categoryType"),
        Index("OriginalText_status_idx", "status"),
        Index("OriginalText_author_idx", "author"),
        Index("OriginalText_contentMd5_idx", "contentMd5"),
        Index("OriginalText_auditStatus_idx", "auditStatus"),
    )


class AiConfig(Base):
    __tablename__ = "AiConfig"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    apiKey = Column(String, nullable=False)
    baseUrl = Column(String, nullable=False)
    model = Column(String, nullable=False)
    temperature = Column(Float, default=0.7)
    maxTokens = Column(Integer, default=2048)
    promptTemplate = Column(Text, nullable=True)
    pinyinPromptTemplate = Column(Text, nullable=True)
    simplifyPromptTemplate = Column(Text, nullable=True)
    classifyPromptTemplate = Column(Text, nullable=True)
    timeoutMs = Column(Integer, default=60000)
    retryCount = Column(Integer, default=2)
    batchConcurrency = Column(Integer, default=3)
    isDefault = Column(Boolean, default=False)
    isActive = Column(Boolean, default=True)
    remark = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (Index("AiConfig_isActive_isDefault_idx", "isActive", "isDefault"),)


class AiExtractTask(Base):
    __tablename__ = "AiExtractTask"

    id = Column(Integer, primary_key=True, autoincrement=True)
    configId = Column(Integer, ForeignKey("AiConfig.id"), nullable=False)
    originalTextId = Column(Integer, nullable=True)
    batchSource = Column(String, nullable=True)
    batchIds = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending / running / success / failed
    totalCount = Column(Integer, default=0)
    successCount = Column(Integer, default=0)
    failCount = Column(Integer, default=0)
    extractedQuotes = Column(Text, nullable=True)
    errorMessage = Column(String, nullable=True)
    startAt = Column(DateTime, nullable=True)
    endAt = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("AiExtractTask_configId_idx", "configId"),
        Index("AiExtractTask_status_idx", "status"),
    )


class SystemConfig(Base):
    __tablename__ = "SystemConfig"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=False)
    remark = Column(String, nullable=True)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PaymentConfig(Base):
    __tablename__ = "PaymentConfig"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payChannel = Column(String, unique=True, nullable=False)
    appId = Column(String, nullable=True)
    mchId = Column(String, nullable=True)
    apiKey = Column(String, nullable=True)
    notifyUrl = Column(String, nullable=True)
    isActive = Column(Boolean, default=True)
    remark = Column(String, nullable=True)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)
