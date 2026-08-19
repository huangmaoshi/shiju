import { PrismaClient, Prisma } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { PageResult, QuoteDetail, QuoteSummary, CategorySimple } from '@/types';

const prisma = new PrismaClient();

interface ListParams {
    categoryType?: string;
    categoryId?: number;
    keyword?: string;
    page?: number;
    pageSize?: number;
}

function toUserId(userId: string | number | undefined): number | undefined {
    if (userId === undefined || userId === null) return undefined;
    const n = Number(userId);
    return Number.isNaN(n) ? undefined : n;
}

async function list(
    userId: string | number | undefined,
    params: ListParams
): Promise<PageResult<QuoteSummary>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuoteWhereInput = { isActive: true, auditStatus: 1 };

    if (params.keyword) {
        where.OR = [
            { content: { contains: params.keyword } },
            { author: { contains: params.keyword } },
            { source: { contains: params.keyword } },
        ];
    }

    if (params.categoryId) {
        where.quoteCategories = { some: { categoryId: params.categoryId } };
    }

    if (params.categoryType) {
        where.quoteCategories = {
            some: { category: { type: params.categoryType } },
        };
    }

    const [total, quotes] = await Promise.all([
        prisma.quote.count({ where }),
        prisma.quote.findMany({
            where,
            skip,
            take: pageSize,
            include: {
                quoteCategories: {
                    include: { category: true },
                },
                originalText: {
                    select: { id: true, title: true, author: true },
                },
            },
            orderBy: { id: 'desc' },
        }),
    ]);

    const list: QuoteSummary[] = quotes.map((q) => {
        const item: QuoteSummary = {
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
        };
        if (q.originalText) {
            item.originalText = {
                id: String(q.originalText.id),
                title: q.originalText.title,
                author: q.originalText.author ?? undefined,
            };
        }
        return item;
    });

    return { total, list };
}

async function getById(
    id: number,
    userId?: string | number
): Promise<QuoteDetail | null> {
    const uid = toUserId(userId);

    const quote = await prisma.quote.findUnique({
        where: { id, isActive: true, auditStatus: 1 },
        include: {
            quoteCategories: { include: { category: true } },
            originalText: {
                select: { id: true, title: true, author: true, content: true, summary: true },
            },
        },
    });

    if (!quote) return null;

    let collected = false;
    let inRecitePlan = false;

    if (uid !== undefined) {
        const [coll, plan] = await Promise.all([
            prisma.collectionQuote.findFirst({
                where: { quoteId: id, collection: { userId: uid } },
            }),
            prisma.recitePlan.findFirst({
                where: { quoteId: id, userId: uid },
            }),
        ]);
        collected = !!coll;
        inRecitePlan = !!plan;
    }

    const categories: CategorySimple[] = quote.quoteCategories.map((qc) => ({
        id: String(qc.category.id),
        name: qc.category.name,
        type: qc.category.type,
    }));

    const detail: QuoteDetail = {
        id: String(quote.id),
        content: quote.content,
        author: quote.author ?? undefined,
        source: quote.source ?? undefined,
        summary: quote.summary ?? undefined,
        isFree: quote.isFree,
        categories,
        wordCount: quote.wordCount,
        isLongText: quote.wordCount > 100,
        pinyinData: quote.pinyinData ?? undefined,
        collected,
        inRecitePlan,
    };

    if (quote.originalText) {
        detail.originalText = {
            id: String(quote.originalText.id),
            title: quote.originalText.title,
            author: quote.originalText.author ?? undefined,
            content: quote.originalText.content,
            summary: quote.originalText.summary ?? undefined,
        };
    }

    return detail;
}

async function random(
    userId: string | number | undefined,
    limit: number = 10
): Promise<QuoteDetail[]> {
    const uid = toUserId(userId);

    const where: Prisma.QuoteWhereInput = { isActive: true, auditStatus: 1 };
    const total = await prisma.quote.count({ where });
    if (total === 0) return [];

    const take = Math.min(limit, total);
    const skip = Math.max(0, Math.floor(Math.random() * (total - take + 1)));

    const quotes = await prisma.quote.findMany({
        where,
        skip,
        take,
        include: {
            quoteCategories: { include: { category: true } },
            originalText: {
                select: { id: true, title: true, author: true },
            },
        },
    });

    let collectedIds: Set<number> = new Set();
    let planIds: Set<number> = new Set();

    if (uid !== undefined && quotes.length > 0) {
        const quoteIds = quotes.map((q) => q.id);
        const [colls, plans] = await Promise.all([
            prisma.collectionQuote.findMany({
                where: { quoteId: { in: quoteIds }, collection: { userId: uid } },
                select: { quoteId: true },
            }),
            prisma.recitePlan.findMany({
                where: { quoteId: { in: quoteIds }, userId: uid },
                select: { quoteId: true },
            }),
        ]);
        collectedIds = new Set(colls.map((c) => c.quoteId!).filter(Boolean));
        planIds = new Set(plans.map((p) => p.quoteId!).filter(Boolean));
    }

    return quotes.map((quote) => {
        const categories: CategorySimple[] = quote.quoteCategories.map((qc) => ({
            id: String(qc.category.id),
            name: qc.category.name,
            type: qc.category.type,
        }));
        const item: QuoteDetail = {
            id: String(quote.id),
            content: quote.content,
            author: quote.author ?? undefined,
            source: quote.source ?? undefined,
            summary: quote.summary ?? undefined,
            isFree: quote.isFree,
            categories,
            wordCount: quote.wordCount,
            isLongText: quote.wordCount > 100,
            pinyinData: quote.pinyinData ?? undefined,
            collected: collectedIds.has(quote.id),
            inRecitePlan: planIds.has(quote.id),
        };
        if (quote.originalText) {
            item.originalText = {
                id: String(quote.originalText.id),
                title: quote.originalText.title,
                author: quote.originalText.author ?? undefined,
            };
        }
        return item;
    });
}

export { list, getById, random };

