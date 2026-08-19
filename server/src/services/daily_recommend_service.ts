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
    const total = await prisma.quote.count({ where: { isActive: true, auditStatus: 1 } });
    if (total === 0) {
        throw new BusinessError(500, '暂无可推荐的名句');
    }

    const randomQuoteIds = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM Quote WHERE isActive = 1 AND auditStatus = 1 ORDER BY RANDOM() LIMIT 10
    `;

    const quoteIds = randomQuoteIds.map((r) => r.id);
    if (quoteIds.length === 0) {
        const quotes = await prisma.quote.findMany({
            where: { isActive: true, auditStatus: 1 },
            take: 10,
            select: { id: true },
        });
        quoteIds.push(...quotes.map((q) => q.id));
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

