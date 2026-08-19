import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { QuoteDetail, CategorySimple } from '@/types';

const prisma = new PrismaClient();

interface DailyRecommendItem {
    id: number;
    recommendDate: string;
    theme?: string;
    quotes: QuoteDetail[];
}

async function getToday(): Promise<DailyRecommendItem> {
    const todayStr = formatDate(new Date());

    let record = await prisma.dailyRecommend.findUnique({
        where: { recommendDate: startOfDay(new Date()) },
        include: {
            dailyRecommendQuotes: {
                orderBy: { sort: 'asc' },
                include: {
                    quote: { include: { quoteCategories: { include: { category: true } } } },
                },
            },
        },
    });

    if (!record) {
        record = await generateTodayRecommend();
    }

    return toDailyRecommendItem(record);
}

async function getByDate(date: string): Promise<DailyRecommendItem | null> {
    const d = new Date(date);
    if (isNaN(d.getTime())) throw new BusinessError(400, '日期格式无效');

    const record = await prisma.dailyRecommend.findUnique({
        where: { recommendDate: startOfDay(d) },
        include: {
            dailyRecommendQuotes: {
                orderBy: { sort: 'asc' },
                include: {
                    quote: { include: { quoteCategories: { include: { category: true } } } },
                },
            },
        },
    });

    if (!record) return null;
    return toDailyRecommendItem(record);
}

async function generateTodayRecommend() {
    // 跨数据库兼容：用 findMany 获取全部 id，JS 随机抽取（避免 RANDOM() 方言差异）
    const allQuotes = await prisma.quote.findMany({
        where: { isActive: true, auditStatus: 1 },
        select: { id: true },
    });
    if (allQuotes.length === 0) {
        throw new BusinessError(500, '暂无可推荐的名句');
    }

    // Fisher-Yates 随机抽取 10 个
    const pool = allQuotes.map((q) => q.id);
    const takeCount = Math.min(10, pool.length);
    const quoteIds: number[] = [];
    for (let i = 0; i < takeCount; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        quoteIds.push(pool.splice(idx, 1)[0]);
    }

    const today = startOfDay(new Date());
    const record = await prisma.dailyRecommend.create({
        data: {
            recommendDate: today,
            theme: '今日精选',
            dailyRecommendQuotes: {
                create: quoteIds.map((qid, idx) => ({ quoteId: qid, sort: idx })),
            },
        },
        include: {
            dailyRecommendQuotes: {
                orderBy: { sort: 'asc' },
                include: {
                    quote: { include: { quoteCategories: { include: { category: true } } } },
                },
            },
        },
    });

    return record;
}

function toDailyRecommendItem(record: {
    id: number;
    recommendDate: Date;
    theme?: string | null;
    dailyRecommendQuotes: Array<{
        quote: {
            id: number;
            content: string;
            author?: string | null;
            source?: string | null;
            summary?: string | null;
            isFree: boolean;
            wordCount: number;
            pinyinData?: string | null;
            quoteCategories: Array<{ category: { id: number; name: string; type: string } }>;
        };
    }>;
}): DailyRecommendItem {
    const quotes: QuoteDetail[] = record.dailyRecommendQuotes.map((rq) => {
        const q = rq.quote;
        const categories: CategorySimple[] = q.quoteCategories.map((qc) => ({
            id: String(qc.category.id),
            name: qc.category.name,
            type: qc.category.type,
        }));
        return {
            id: String(q.id),
            content: q.content,
            author: q.author ?? undefined,
            source: q.source ?? undefined,
            summary: q.summary ?? undefined,
            isFree: q.isFree,
            categories,
            wordCount: q.wordCount,
            isLongText: q.wordCount > 100,
            pinyinData: q.pinyinData ?? undefined,
            collected: false,
            inRecitePlan: false,
        };
    });

    return {
        id: record.id,
        recommendDate: formatDate(record.recommendDate),
        theme: record.theme ?? undefined,
        quotes,
    };
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export { getToday, getByDate };

