import { PrismaClient } from "@prisma/client";
import dedup from "@/utils/dedup";

const prisma = new PrismaClient();

interface JsonRecord {
    content?: string;
    quote?: string;
    text?: string;
    author?: string;
    "作者"?: string;
    title?: string;
    rhythmic?: string;        // 词牌名（宋词）
    strains?: unknown;        // 平仄韵律（暂用不到，保留）
    prologue?: string;        // 题记小序
    source?: string;
    dynasty?: string;
    tags?: string[] | string;
    categoryType?: string;
    poem_type?: string;
    type?: string;
    paragraphs?: string[];
    [key: string]: unknown;
}

function pickContent(item: JsonRecord): string | undefined {
    // prologue（小序）+ paragraphs/正文 一并拼接
    let parts: string[] = [];
    if (typeof item.prologue === "string" && item.prologue.trim()) {
        parts.push(item.prologue.trim());
    }
    if (Array.isArray(item.paragraphs)) {
        const joined = (item.paragraphs as string[]).filter((s) => typeof s === "string").join("\n");
        if (joined.trim()) parts.push(joined.trim());
    } else {
        for (const key of ["content", "quote", "text"]) {
            const v = item[key];
            if (typeof v === "string" && v.trim()) {
                parts.push(v.trim());
                break;
            }
        }
    }
    const merged = parts.filter(Boolean).join("\n\n").trim();
    return merged || undefined;
}

function pickAuthor(item: JsonRecord): string | undefined {
    if (typeof item.author === "string" && item.author.trim()) return item.author.trim();
    if (typeof item["作者"] === "string" && item["作者"].trim()) return item["作者"].trim();
    return undefined;
}

function pickTitle(item: JsonRecord): string | undefined {
    // 优先级：title（诗） → rhythmic（词牌名）
    if (typeof item.title === "string" && item.title.trim()) return item.title.trim();
    if (typeof item.rhythmic === "string" && item.rhythmic.trim()) return item.rhythmic.trim();
    return undefined;
}

function pickTags(item: JsonRecord): string | undefined {
    if (Array.isArray(item.tags)) {
        const arr = item.tags.filter((t) => typeof t === "string") as string[];
        if (arr.length) return arr.join(",");
    }
    if (typeof item.tags === "string" && item.tags.trim()) return item.tags.trim();
    const c = (item.categoryType || item.poem_type || item.type) as string | undefined;
    if (typeof c === "string" && c.trim()) return c.trim();
    return undefined;
}

function pickCategoryType(item: JsonRecord, fallback?: string): string | undefined {
    const c = (item.categoryType || item.poem_type || item.type) as string | undefined;
    if (typeof c === "string" && c.trim()) return c.trim();
    return fallback;
}

function parseJson(raw: unknown): JsonRecord[] {
    if (Array.isArray(raw)) return raw as JsonRecord[];
    if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as JsonRecord[];
        if (Array.isArray(obj.items)) return obj.items as JsonRecord[];
        if (Array.isArray(obj.list)) return obj.list as JsonRecord[];
    }
    return [];
}

export interface ImportResult {
    totalFetched: number;
    totalInserted: number;
    totalSkipped: number;
    originalTextsInserted: number;
    skippedReason: { md5: number; simhash: number };
    errors: string[];
}

interface DedupStores {
    originalMd5s: Set<string>;
    originalSimHashes: string[];
    localBatchMd5s: Set<string>;
}

async function loadExistingStores(): Promise<DedupStores> {
    const stores: DedupStores = {
        originalMd5s: new Set<string>(),
        originalSimHashes: [],
        localBatchMd5s: new Set<string>(),
    };

    const origMd5Rows = await prisma.originalText.findMany({
        where: { contentMd5: { not: null } },
        select: { contentMd5: true },
    });
    for (const r of origMd5Rows) if (r.contentMd5) stores.originalMd5s.add(r.contentMd5);

    const origSimRows = await prisma.originalText.findMany({
        where: { simHash: { not: null } },
        select: { simHash: true },
    });
    for (const r of origSimRows) if (r.simHash) stores.originalSimHashes.push(r.simHash);

    // CrawlRecord 临时库也比对
    const recRows = await prisma.crawlRecord.findMany({
        select: { content: true, simHash: true },
    });
    for (const r of recRows) {
        const fp = dedup.fingerprint(r.content);
        stores.originalMd5s.add(fp.contentMd5);
        if (fp.simHash) stores.originalSimHashes.push(fp.simHash);
    }

    return stores;
}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            headers: { "User-Agent": "ShiJu-Crawler/1.0 (+https://github.com)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchWithRetry(url: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const resp = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
            if (resp.status === 404) {
                return { ok: false, error: `HTTP 404 资源不存在（已尝试 ${attempt} 次）` };
            }
            if (resp.status >= 400 && resp.status < 500) {
                const detail = await resp.text().catch(() => "");
                return { ok: false, error: `HTTP ${resp.status} ${resp.statusText}: ${detail.slice(0, 200)}` };
            }
            if (!resp.ok) {
                lastError = `HTTP ${resp.status} ${resp.statusText}`;
            } else {
                const text = await resp.text();
                return { ok: true, text };
            }
        } catch (err: any) {
            if (err?.name === "AbortError") {
                lastError = `请求超时 (${FETCH_TIMEOUT_MS}ms)`;
            } else {
                lastError = err?.cause
                    ? `${err.message}: ${err.cause.code || err.cause.message}`
                    : err?.message || String(err);
            }
        }
        if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
    }
    return { ok: false, error: `${lastError}（重试 ${MAX_RETRIES} 次仍失败）` };
}

export async function importFromGithubRaw(options: {
    rawUrl: string;
    taskId: number;
    sourceId: number;
    sourceName?: string;
    complianceTag?: string;
    protocol?: string;
    datasetType?: string;
    categoryType?: string;
    provider?: string;
}): Promise<ImportResult> {
    const result: ImportResult = {
        totalFetched: 0,
        totalInserted: 0,
        totalSkipped: 0,
        originalTextsInserted: 0,
        skippedReason: { md5: 0, simhash: 0 },
        errors: [],
    };

    const fetched = await fetchWithRetry(options.rawUrl);
    if (!fetched.ok) {
        result.errors.push(`下载失败 [${options.rawUrl}]: ${(fetched as { ok: false; error: string }).error}`);
        return result;
    }
    const text = (fetched as { ok: true; text: string }).text;

    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch (err: any) {
        result.errors.push(`JSON 解析失败: ${err.message}`);
        return result;
    }

    const records = parseJson(data);
    result.totalFetched = records.length;
    if (records.length === 0) {
        result.errors.push("未解析到任何记录，数据结构可能不匹配");
        return result;
    }

    const stores = await loadExistingStores();
    const simThreshold = dedup.DEFAULT_SIMHASH_THRESHOLD;

    for (const item of records) {
        const content = pickContent(item);
        if (!content || content.length < 2) {
            result.totalSkipped++;
            continue;
        }

        const fp = dedup.fingerprint(content);

        // === OriginalText 去重 ===
        // 1) 本地批次 MD5 快速拦截
        if (stores.localBatchMd5s.has(fp.contentMd5)) {
            result.totalSkipped++;
            result.skippedReason.md5++;
            continue;
        }
        // 2) 正式素材库 MD5
        if (stores.originalMd5s.has(fp.contentMd5)) {
            result.totalSkipped++;
            result.skippedReason.md5++;
            continue;
        }
        // 3) 长文本 SimHash 相似度 > 85%
        if (content.length >= dedup.SHORT_TEXT_BOUNDARY) {
            let simDup = false;
            for (const existingHash of stores.originalSimHashes) {
                if (dedup.hammingDistance(fp.simHash, existingHash) <= simThreshold) {
                    simDup = true;
                    break;
                }
            }
            if (simDup) {
                result.totalSkipped++;
                result.skippedReason.simhash++;
                continue;
            }
        }

        stores.localBatchMd5s.add(fp.contentMd5);
        stores.originalMd5s.add(fp.contentMd5);
        stores.originalSimHashes.push(fp.simHash);

        const title = pickTitle(item);
        const author = pickAuthor(item);
        const tags = pickTags(item);
        const catType = pickCategoryType(item, options.categoryType);
        const wordCount = content.length;
        const sourceName =
            (typeof item.source === "string" ? item.source : undefined) ||
            options.sourceName ||
            options.provider ||
            "GitHub";

        try {
            await prisma.originalText.create({
                data: {
                    title: title || content.slice(0, 30),
                    contentMd5: fp.contentMd5,
                    simHash: fp.simHash,
                    author,
                    source: sourceName,
                    sourceUrl: options.rawUrl,
                    categoryType: catType,
                    content,
                    summary: content.length > 200 ? content.slice(0, 200) + "…" : null,
                    tags,
                    wordCount,
                    provider: options.provider || "github_dataset",
                    complianceTag: options.complianceTag,
                    auditStatus: 0,
                    quoteCount: 0,
                },
            });
            result.originalTextsInserted++;
        } catch (err: any) {
            if (err?.code !== "P2002") {
                result.errors.push(`OriginalText 写入失败: ${err.message}`);
            }
            result.totalSkipped++;
            continue;
        }

        // 采集临时库（供后续双重比对）
        try {
            await prisma.crawlRecord.create({
                data: {
                    taskId: options.taskId,
                    sourceId: options.sourceId,
                    originalUrl: options.rawUrl,
                    content,
                    author,
                    sourceName,
                    fingerprint: fp.contentMd5,
                    simHash: fp.simHash,
                    categoryType: catType,
                    auditStatus: 0,
                },
            });
        } catch {
            // ignore
        }

        result.totalInserted++;
    }

    return result;
}
