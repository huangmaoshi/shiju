import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dashboard(): Promise<{
    users: { total: number; todayNew: number };
    quotes: { total: number; free: number; memberOnly: number };
    collections: { total: number; quotes: number };
    todayActivity: {
        newOrders: number;
        newCollections: number;
        newRecitePlans: number;
        reviews: number;
    };
}> {
    const now = new Date();
    const startOfToday = startOfDay(now);

    const [
        totalUsers,
        todayNewUsers,
        totalQuotes,
        freeQuotes,
        memberOnlyQuotes,
        totalCollections,
        totalCollectionQuotes,
        newOrders,
        newCollections,
        newRecitePlans,
        reviews,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.quote.count({ where: { isActive: true, auditStatus: 1 } }),
        prisma.quote.count({ where: { isActive: true, auditStatus: 1, isFree: true } }),
        prisma.quote.count({ where: { isActive: true, auditStatus: 1, isFree: false } }),
        prisma.collection.count(),
        prisma.collectionQuote.count(),
        prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.collection.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.recitePlan.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.reciteLog.count({ where: { reviewDate: { gte: startOfToday } } }),
    ]);

    return {
        users: { total: totalUsers, todayNew: todayNewUsers },
        quotes: {
            total: totalQuotes,
            free: freeQuotes,
            memberOnly: memberOnlyQuotes,
        },
        collections: {
            total: totalCollections,
            quotes: totalCollectionQuotes,
        },
        todayActivity: {
            newOrders,
            newCollections,
            newRecitePlans,
            reviews,
        },
    };
}

/**
 * 首页公开统计数据（无需登录）
 * 返回真实的数据库统计值，用于用户首页卡片展示
 */
async function homeStats(): Promise<{
    quoteTotal: number;
    categoryTotal: number;
    templateTotal: number;
    dailyRecommendCount: number;
}> {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const [quoteTotal, categoryTotal, templateTotal, dailyCount] = await Promise.all([
        prisma.quote.count({ where: { isActive: true, auditStatus: 1 } }),
        prisma.category.count({ where: { status: 1 } }),
        prisma.compositionTemplate.count({ where: { status: 1 } }),
        prisma.dailyRecommendQuote.count({
            where: { recommend: { recommendDate: { gte: today, lt: tomorrow } } },
        }),
    ]);

    return {
        quoteTotal,
        categoryTotal,
        templateTotal,
        dailyRecommendCount: dailyCount,
    };
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

export { dashboard, homeStats };

