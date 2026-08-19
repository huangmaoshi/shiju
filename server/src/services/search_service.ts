import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { PageResult, QuoteSummary, CategorySimple } from '@/types';

const prisma = new PrismaClient();

interface OriginalTextSearchResult {
    id: string;
    title: string;
    author?: string;
    summary?: string;
    wordCount: number;
    quoteCount: number;
    matchedContent: string;
}

function extractMatchedContext(content: string, keyword: string): string {
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const idx = lowerContent.indexOf(lowerKeyword);
    if (idx === -1) {
        return content.slice(0, 80);
    }
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + keyword.length + 40);
    const before = start > 0 ? '...' : '';
    const after = end < content.length ? '...' : '';
    const snippet = content.slice(start, end);
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const highlighted = snippet.replace(
        new RegExp(escaped, 'gi'),
        (m) => `**${m}**`
    );
    return `${before}${highlighted}${after}`;
}

interface CacheEntry {
    data: string[];
    expireAt: number;
}

const hotKeywordCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function searchQuotes(
    userId: string | number | null | undefined,
    keyword: string,
    page: number,
    pageSize: number
): Promise<PageResult<QuoteSummary>> {
    if (!keyword || keyword.trim().length === 0) {
        throw new BusinessError(400, '搜索关键词不能为空');
    }

    const kw = keyword.trim();
    const skip = (page - 1) * pageSize;

    const where = {
        isActive: true,
        auditStatus: 1,
        OR: [
            { content: { contains: kw } },
            { author: { contains: kw } },
            { source: { contains: kw } },
        ],
    };

    const [total, quotes] = await Promise.all([
        prisma.quote.count({ where }),
        prisma.quote.findMany({
            where,
            skip,
            take: pageSize,
            include: { quoteCategories: { include: { category: true } } },
            orderBy: { id: 'desc' },
        }),
    ]);

    const list: QuoteSummary[] = quotes.map((q) => ({
        id: String(q.id),
        content: q.content,
        author: q.author ?? undefined,
        source: q.source ?? undefined,
        summary: q.summary ?? undefined,
        isFree: q.isFree,
        categories: q.quoteCategories.map((qc) => ({
            id: String(qc.category.id),
            name: qc.category.name,
            type: qc.category.type,
        })),
    }));

    return { total, list };
}

async function getHotKeywords(): Promise<string[]> {
    const cached = hotKeywordCache.get('hot');
    if (cached && cached.expireAt > Date.now()) {
        return cached.data;
    }

    const results = await prisma.$queryRaw<Array<{ keyword: string; count: number }>>`
        SELECT keyword, COUNT(*) as count
        FROM SearchHistory
        GROUP BY keyword
        ORDER BY count DESC
        LIMIT 10
    `;

    const keywords = results.map((r) => r.keyword);
    hotKeywordCache.set('hot', { data: keywords, expireAt: Date.now() + CACHE_TTL_MS });

    return keywords;
}

async function searchOriginalText(
    keyword: string,
    page: number,
    pageSize: number
): Promise<PageResult<OriginalTextSearchResult>> {
    if (!keyword || keyword.trim().length === 0) {
        throw new BusinessError(400, '搜索关键词不能为空');
    }

    const kw = keyword.trim();
    const skip = (page - 1) * pageSize;

    const where = {
        auditStatus: 1,
        OR: [
            { title: { contains: kw } },
            { content: { contains: kw } },
            { author: { contains: kw } },
        ],
    };

    const [total, records] = await Promise.all([
        prisma.originalText.count({ where }),
        prisma.originalText.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { id: 'desc' },
        }),
    ]);

    const list: OriginalTextSearchResult[] = records.map((r) => ({
        id: String(r.id),
        title: r.title,
        author: r.author ?? undefined,
        summary: r.summary ?? undefined,
        wordCount: r.wordCount,
        quoteCount: r.quoteCount,
        matchedContent: extractMatchedContext(r.content, kw),
    }));

    return { total, list };
}

async function saveHistory(userId: number, keyword: string): Promise<void> {
    if (!keyword || keyword.trim().length === 0) return;

    const kw = keyword.trim();

    await prisma.searchHistory.deleteMany({
        where: { userId, keyword: kw },
    });

    await prisma.searchHistory.create({
        data: { userId, keyword: kw },
    });
}

async function clearHistory(userId: number): Promise<void> {
    await prisma.searchHistory.deleteMany({ where: { userId } });
}

const getHot = getHotKeywords;
export { searchQuotes, searchOriginalText, getHotKeywords, getHot, saveHistory, clearHistory };


