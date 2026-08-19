import { PrismaClient, Prisma } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { PageResult, QuoteDetail } from '@/types';

const prisma = new PrismaClient();

interface CollectionWithCount {
    id: number;
    userId: number;
    name: string;
    description?: string;
    isDefault: number;
    quoteCount: number;
    createdAt: Date;
    updatedAt: Date;
}

function toUserId(userId: string | number): number {
    const n = Number(userId);
    if (Number.isNaN(n)) {
        throw new BusinessError(400, '无效的用户ID');
    }
    return n;
}

async function list(userId: string | number): Promise<CollectionWithCount[]> {
    const uid = toUserId(userId);
    return prisma.collection.findMany({
        where: { userId: uid },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
}

async function ensureDefaultCollection(userId: number): Promise<void> {
    const hasDefault = await prisma.collection.findFirst({
        where: { userId, isDefault: 1 },
    });
    if (!hasDefault) {
        await prisma.collection.create({
            data: {
                userId,
                name: '我的收藏',
                isDefault: 1,
            },
        });
    }
}

async function create(
    userId: string | number,
    data: { name: string; description?: string; isDefault?: number }
): Promise<CollectionWithCount> {
    const uid = toUserId(userId);
    const { name, description, isDefault = 0 } = data;

    if (isDefault === 1) {
        await prisma.collection.updateMany({
            where: { userId: uid, isDefault: 1 },
            data: { isDefault: 0 },
        });
    }

    await ensureDefaultCollection(uid);

    return prisma.collection.create({
        data: {
            userId: uid,
            name,
            description,
            isDefault,
        },
    });
}

async function rename(
    userId: string | number,
    id: number,
    name: string
): Promise<CollectionWithCount> {
    const uid = toUserId(userId);
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== uid) {
        throw new BusinessError(404, '收藏夹不存在');
    }
    return prisma.collection.update({
        where: { id },
        data: { name },
    });
}

async function update(
    userId: string | number,
    id: number,
    name?: string,
    description?: string
): Promise<CollectionWithCount> {
    const uid = toUserId(userId);
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== uid) {
        throw new BusinessError(404, '收藏夹不存在');
    }
    const data: { name?: string; description?: string } = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    return prisma.collection.update({
        where: { id },
        data,
    });
}

async function remove(userId: string | number, id: number): Promise<void> {
    const uid = toUserId(userId);
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection || collection.userId !== uid) {
        throw new BusinessError(404, '收藏夹不存在');
    }
    if (collection.isDefault === 1) {
        throw new BusinessError(400, '默认收藏夹不能删除');
    }

    await prisma.collectionQuote.deleteMany({ where: { collectionId: id } });
    await prisma.collection.delete({ where: { id } });
}

async function addQuote(
    userId: string | number,
    collectionId: number,
    data: { quoteId?: number; customQuoteId?: number }
): Promise<void> {
    const uid = toUserId(userId);
    const { quoteId, customQuoteId } = data;

    if (!quoteId && !customQuoteId) {
        throw new BusinessError(400, 'quoteId 或 customQuoteId 不能同时为空');
    }
    if (quoteId && customQuoteId) {
        throw new BusinessError(400, 'quoteId 和 customQuoteId 只能传一个');
    }

    const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== uid) {
        throw new BusinessError(404, '收藏夹不存在');
    }

    const duplicate = await prisma.collectionQuote.findFirst({
        where: quoteId
            ? { collectionId, quoteId }
            : { collectionId, customQuoteId: customQuoteId! },
    });
    if (duplicate) {
        throw new BusinessError(400, '该句已在收藏夹中');
    }

    await prisma.$transaction([
        prisma.collectionQuote.create({
            data: { collectionId, quoteId, customQuoteId },
        }),
        prisma.collection.update({
            where: { id: collectionId },
            data: { quoteCount: { increment: 1 } },
        }),
    ]);
}

async function removeQuote(
    userId: string | number,
    collectionId: number,
    recordId: number
): Promise<void> {
    const uid = toUserId(userId);

    const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== uid) {
        throw new BusinessError(404, '收藏夹不存在');
    }

    const record = await prisma.collectionQuote.findUnique({ where: { id: recordId } });
    if (!record || record.collectionId !== collectionId) {
        throw new BusinessError(404, '收藏记录不存在');
    }

    await prisma.$transaction([
        prisma.collectionQuote.delete({ where: { id: recordId } }),
        prisma.collection.update({
            where: { id: collectionId },
            data: { quoteCount: { decrement: 1 } },
        }),
    ]);
}

async function getQuotes(
    userId: string | number,
    collectionId: number,
    page: number,
    pageSize: number
): Promise<PageResult<QuoteDetail>> {
    const uid = toUserId(userId);

    const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== uid) {
        throw new BusinessError(404, '收藏夹不存在');
    }

    const skip = (page - 1) * pageSize;

    const [total, records] = await Promise.all([
        prisma.collectionQuote.count({ where: { collectionId } }),
        prisma.collectionQuote.findMany({
            where: { collectionId },
            skip,
            take: pageSize,
            include: {
                quote: { include: { quoteCategories: { include: { category: true } } } },
                customQuote: true,
            },
            orderBy: { addedAt: 'desc' },
        }),
    ]);

    const list: QuoteDetail[] = records.map((r) => {
        if (r.quote) {
            const categories = r.quote.quoteCategories.map((qc) => ({
                id: String(qc.category.id),
                name: qc.category.name,
                type: qc.category.type,
            }));
            return {
                id: String(r.quote.id),
                content: r.quote.content,
                author: r.quote.author ?? undefined,
                source: r.quote.source ?? undefined,
                summary: r.quote.summary ?? undefined,
                isFree: r.quote.isFree,
                categories,
                wordCount: r.quote.wordCount,
                isLongText: r.quote.wordCount > 100,
                pinyinData: r.quote.pinyinData ?? undefined,
                collected: true,
                inRecitePlan: false,
            };
        }
        if (r.customQuote) {
            return {
                id: `custom_${r.customQuote.id}`,
                content: r.customQuote.content,
                author: r.customQuote.author ?? undefined,
                source: r.customQuote.source ?? undefined,
                summary: undefined,
                isFree: true,
                categories: [],
                wordCount: r.customQuote.content.length,
                isLongText: r.customQuote.content.length > 100,
                pinyinData: undefined,
                collected: true,
                inRecitePlan: false,
            };
        }
        throw new BusinessError(400, '收藏记录异常');
    });

    return { total, list };
}

async function collectQuote(
    userId: string | number,
    quoteId: number
): Promise<void> {
    const uid = toUserId(userId);
    await ensureDefaultCollection(uid);

    const defaultCollection = await prisma.collection.findFirst({
        where: { userId: uid, isDefault: 1 },
    });
    if (!defaultCollection) {
        throw new BusinessError(404, '默认收藏夹不存在');
    }

    const duplicate = await prisma.collectionQuote.findFirst({
        where: { collectionId: defaultCollection.id, quoteId },
    });
    if (duplicate) {
        throw new BusinessError(400, '该句已在收藏夹中');
    }

    await prisma.$transaction([
        prisma.collectionQuote.create({
            data: { collectionId: defaultCollection.id, quoteId },
        }),
        prisma.collection.update({
            where: { id: defaultCollection.id },
            data: { quoteCount: { increment: 1 } },
        }),
    ]);
}

async function uncollectQuote(
    userId: string | number,
    quoteId: number
): Promise<void> {
    const uid = toUserId(userId);

    const defaultCollection = await prisma.collection.findFirst({
        where: { userId: uid, isDefault: 1 },
    });
    if (!defaultCollection) return;

    const record = await prisma.collectionQuote.findFirst({
        where: { collectionId: defaultCollection.id, quoteId },
    });
    if (!record) return;

    await prisma.$transaction([
        prisma.collectionQuote.delete({ where: { id: record.id } }),
        prisma.collection.update({
            where: { id: defaultCollection.id },
            data: { quoteCount: { decrement: 1 } },
        }),
    ]);
}

async function stats(userId: string | number): Promise<{
    totalCollections: number;
    totalQuotes: number;
    favoriteQuote?: QuoteDetail;
}> {
    const uid = toUserId(userId);

    const [totalCollections, totalQuotes, favorite] = await Promise.all([
        prisma.collection.count({ where: { userId: uid } }),
        prisma.collectionQuote.count({
            where: { collection: { userId: uid } },
        }),
        prisma.collectionQuote.findFirst({
            where: { collection: { userId: uid } },
            orderBy: { addedAt: 'desc' },
            include: {
                quote: { include: { quoteCategories: { include: { category: true } } } },
                customQuote: true,
            },
        }),
    ]);

    let favoriteQuote: QuoteDetail | undefined;
    if (favorite) {
        if (favorite.quote) {
            const categories = favorite.quote.quoteCategories.map((qc) => ({
                id: String(qc.category.id),
                name: qc.category.name,
                type: qc.category.type,
            }));
            favoriteQuote = {
                id: String(favorite.quote.id),
                content: favorite.quote.content,
                author: favorite.quote.author ?? undefined,
                source: favorite.quote.source ?? undefined,
                summary: favorite.quote.summary ?? undefined,
                isFree: favorite.quote.isFree,
                categories,
                wordCount: favorite.quote.wordCount,
                isLongText: favorite.quote.wordCount > 100,
                pinyinData: favorite.quote.pinyinData ?? undefined,
                collected: true,
                inRecitePlan: false,
            };
        } else if (favorite.customQuote) {
            favoriteQuote = {
                id: `custom_${favorite.customQuote.id}`,
                content: favorite.customQuote.content,
                author: favorite.customQuote.author ?? undefined,
                source: favorite.customQuote.source ?? undefined,
                summary: undefined,
                isFree: true,
                categories: [],
                wordCount: favorite.customQuote.content.length,
                isLongText: favorite.customQuote.content.length > 100,
                pinyinData: undefined,
                collected: true,
                inRecitePlan: false,
            };
        }
    }

    return { totalCollections, totalQuotes, favoriteQuote };
}

export {
    list,
    create,
    rename,
    update,
    remove,
    getQuotes,
    addQuote,
    removeQuote,
    collectQuote,
    uncollectQuote,
    stats,
};
