import * as crypto from "crypto";
import prisma from "../db";
import logger from "../logger";
import { cleanContent, truncateSummary } from "./content_cleaner";
import { checkSensitive } from "./sensitive_checker";
import { computeSimHash } from "../engine/deduper";
import { EnrichedQuote, RawQuote } from "../providers/base_provider";

function md5(text: string): string {
  return crypto.createHash("md5").update(text, "utf-8").digest("hex");
}

function normalizeForDedup(text: string): string {
  return text.replace(/[\s，。！？、；：""''（）《》【】]/g, "").toLowerCase();
}

export interface WriteResult {
  quoteId: number | null;
  crawlRecordId: number | null;
  status: "inserted" | "skipped_duplicate" | "skipped_sensitive" | "error";
  reason?: string;
}

export async function writeQuote(enriched: EnrichedQuote, sourceId?: number, taskId?: number): Promise<WriteResult> {
  const cleanedContent = cleanContent(enriched.content);
  if (!cleanedContent || cleanedContent.length < 3) {
    return { quoteId: null, crawlRecordId: null, status: "error", reason: "内容过短或为空" };
  }

  const contentMd5 = md5(normalizeForDedup(cleanedContent));
  const simHash = enriched.simHash || computeSimHash(cleanedContent);

  const sensitiveResult = checkSensitive(cleanedContent);
  const auditStatus = sensitiveResult.hasSensitive ? 2 : 1;

  // CrawlRecord 临时库去重（MD5 指纹）
  const existingRecord = await prisma.crawlRecord.findFirst({
    where: { fingerprint: contentMd5 },
  });
  if (existingRecord) {
    logger.debug(`CrawlRecord 指纹重复跳过: ${contentMd5}`);
    return {
      quoteId: existingRecord.finalQuoteId,
      crawlRecordId: existingRecord.id,
      status: "skipped_duplicate",
      reason: "CrawlRecord 指纹已存在",
    };
  }

  // 正式 Quote 表去重（MD5）
  const existingQuote = await prisma.quote.findFirst({
    where: { contentMd5 },
  });
  if (existingQuote) {
    logger.debug(`Quote 表 MD5 重复跳过: ${cleanedContent.slice(0, 20)}...`);
    return {
      quoteId: existingQuote.id,
      crawlRecordId: null,
      status: "skipped_duplicate",
      reason: "Quote 表已存在（MD5）",
    };
  }

  const crawlRecord = await prisma.crawlRecord.create({
    data: {
      taskId: taskId || 0,
      sourceId: sourceId || 0,
      originalUrl: enriched.url,
      content: cleanedContent,
      author: enriched.author,
      sourceName: enriched.source,
      rawHtml: null,
      extractMethod: "provider",
      simHash,
      fingerprint: contentMd5,
      categoryType: enriched.categoryType,
      categoryIds: enriched.tags ? enriched.tags.join(",") : null,
      auditStatus,
      auditReason: sensitiveResult.hasSensitive
        ? `命中敏感词: ${sensitiveResult.matchedWords.join(",")}`
        : null,
      auditBy: "crawler",
      auditAt: new Date(),
      finalQuoteId: null,
    },
  });

  if (sensitiveResult.hasSensitive) {
    logger.warn(`敏感内容已标记 auditStatus=2: ${sensitiveResult.matchedWords.join(",")}`);
    return {
      quoteId: null,
      crawlRecordId: crawlRecord.id,
      status: "skipped_sensitive",
      reason: `命中敏感词: ${sensitiveResult.matchedWords.join(",")}`,
    };
  }

  const summary = truncateSummary(cleanedContent, 100);

  const quote = await prisma.quote.create({
    data: {
      content: cleanedContent,
      contentMd5,
      simHash,
      author: enriched.author || null,
      source: enriched.source || null,
      summary,
      tags: enriched.tags ? enriched.tags.join(",") : null,
      wordCount: cleanedContent.length,
      isFree: true,
      isActive: true,
      quoteType: "crawl",
    },
  });

  await prisma.crawlRecord.update({
    where: { id: crawlRecord.id },
    data: { finalQuoteId: quote.id },
  });

  logger.info(`入库成功 Quote#${quote.id}: ${cleanedContent.slice(0, 30)}...`);

  return {
    quoteId: quote.id,
    crawlRecordId: crawlRecord.id,
    status: "inserted",
  };
}

export async function batchWrite(enrichedList: EnrichedQuote[], sourceId?: number, taskId?: number): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  for (const item of enrichedList) {
    try {
      const result = await writeQuote(item, sourceId, taskId);
      results.push(result);
    } catch (err: any) {
      logger.error(`入库异常: ${err.message}`);
      results.push({ quoteId: null, crawlRecordId: null, status: "error", reason: err.message });
    }
  }
  return results;
}

export default { writeQuote, batchWrite };
