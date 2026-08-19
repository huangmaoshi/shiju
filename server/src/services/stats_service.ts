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

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

export { dashboard };

