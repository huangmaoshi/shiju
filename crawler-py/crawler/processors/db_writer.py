"""入库写入

对应 TypeScript 版 crawler/src/processors/db_writer.ts。
去重（复用 server-py utils/dedup.py 的 MD5/SimHash）→ 写 CrawlRecord → 写 Quote。
重复内容更新 CrawlRecord.auditStatus=3 后跳过。
"""
from datetime import datetime

from ..db import CrawlRecord, Quote, get_session
from ..engine.deduper import compute_sim_hash, dedup
from ..logger import logger
from .content_cleaner import clean_content, truncate_summary
from .sensitive_checker import check_sensitive


def normalize_for_dedup(text: str) -> str:
    """对应 TS normalizeForDedup（复用 dedup.normalize）"""
    return dedup["normalize"](text)


def md5(text: str) -> str:
    """对应 TS md5（复用 dedup.md5）"""
    return dedup["md5"](text)


def write_quote(enriched: dict, source_id: int = None, task_id: int = None) -> dict:
    """对应 TS writeQuote

    enriched: EnrichedQuote 字典（content/author/source/url/tags/categoryType/simHash...）
    返回 {quoteId, crawlRecordId, status, reason}
    """
    cleaned_content = clean_content(enriched.get("content") or "")
    if not cleaned_content or len(cleaned_content) < 3:
        return {"quoteId": None, "crawlRecordId": None, "status": "error", "reason": "内容过短或为空"}

    # 复用 server-py dedup：MD5 指纹 + SimHash
    fp = dedup["fingerprint"](cleaned_content)
    content_md5 = fp["contentMd5"]
    sim_hash = enriched.get("simHash") or compute_sim_hash(cleaned_content)

    sensitive_result = check_sensitive(cleaned_content)
    audit_status = 2 if sensitive_result["hasSensitive"] else 1

    db = get_session()
    try:
        # CrawlRecord 临时库去重（MD5 指纹）
        existing_record = (
            db.query(CrawlRecord).filter(CrawlRecord.fingerprint == content_md5).first()
        )
        if existing_record:
            # 重复：更新 auditStatus=3 后跳过
            existing_record.auditStatus = 3
            existing_record.auditReason = "CrawlRecord 指纹已存在"
            db.commit()
            logger.debug(f"CrawlRecord 指纹重复跳过: {content_md5}")
            return {
                "quoteId": existing_record.finalQuoteId,
                "crawlRecordId": existing_record.id,
                "status": "skipped_duplicate",
                "reason": "CrawlRecord 指纹已存在",
            }

        # 正式 Quote 表去重（MD5）
        existing_quote = db.query(Quote).filter(Quote.contentMd5 == content_md5).first()
        if existing_quote:
            logger.debug(f"Quote 表 MD5 重复跳过: {cleaned_content[:20]}...")
            return {
                "quoteId": existing_quote.id,
                "crawlRecordId": None,
                "status": "skipped_duplicate",
                "reason": "Quote 表已存在（MD5）",
            }

        tags = enriched.get("tags")
        crawl_record = CrawlRecord(
            taskId=task_id or 0,
            sourceId=source_id or 0,
            originalUrl=enriched.get("url") or "",
            content=cleaned_content,
            author=enriched.get("author"),
            sourceName=enriched.get("source"),
            rawHtml=None,
            extractMethod="provider",
            simHash=sim_hash,
            fingerprint=content_md5,
            categoryType=enriched.get("categoryType"),
            categoryIds=",".join(tags) if tags else None,
            auditStatus=audit_status,
            auditReason=(
                f"命中敏感词: {','.join(sensitive_result['matchedWords'])}"
                if sensitive_result["hasSensitive"] else None
            ),
            auditBy="crawler",
            auditAt=datetime.now(),
            finalQuoteId=None,
        )
        db.add(crawl_record)
        db.commit()
        db.refresh(crawl_record)

        if sensitive_result["hasSensitive"]:
            logger.warning(f"敏感内容已标记 auditStatus=2: {','.join(sensitive_result['matchedWords'])}")
            return {
                "quoteId": None,
                "crawlRecordId": crawl_record.id,
                "status": "skipped_sensitive",
                "reason": f"命中敏感词: {','.join(sensitive_result['matchedWords'])}",
            }

        summary = truncate_summary(cleaned_content, 100)
        quote = Quote(
            content=cleaned_content,
            contentMd5=content_md5,
            simHash=sim_hash,
            author=enriched.get("author") or None,
            source=enriched.get("source") or None,
            summary=summary,
            tags=",".join(tags) if tags else None,
            wordCount=len(cleaned_content),
            isFree=True,
            isActive=True,
            quoteType="crawl",
        )
        db.add(quote)
        db.commit()
        db.refresh(quote)

        crawl_record.finalQuoteId = quote.id
        db.commit()

        logger.info(f"入库成功 Quote#{quote.id}: {cleaned_content[:30]}...")

        return {
            "quoteId": quote.id,
            "crawlRecordId": crawl_record.id,
            "status": "inserted",
        }
    finally:
        db.close()


def batch_write(enriched_list: list, source_id: int = None, task_id: int = None) -> list:
    """对应 TS batchWrite"""
    results = []
    for item in enriched_list:
        try:
            result = write_quote(item, source_id, task_id)
            results.append(result)
        except Exception as err:
            logger.error(f"入库异常: {err}")
            results.append({"quoteId": None, "crawlRecordId": None, "status": "error", "reason": str(err)})
    return results
