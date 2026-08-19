import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

const EBBINGHAUS = [1, 2, 4, 7, 15, 30, 60];

interface PlanItem {
    id: number;
    userId: number;
    quoteId?: number;
    customQuoteId?: number;
    currentStage: number;
    nextReviewAt: string;
    lastReviewAt?: string;
    masterLevel: number;
    createdAt: string;
}

async function list(userId: number): Promise<PlanItem[]> {
    const plans = await prisma.recitePlan.findMany({
        where: { userId },
        orderBy: { nextReviewAt: 'asc' },
    });

    return plans.map(toPlanItem);
}

async function add(
    userId: number,
    input: { quoteId?: number; customQuoteId?: number }
): Promise<PlanItem> {
    if (!input.quoteId && !input.customQuoteId) {
        throw new BusinessError(400, 'quoteId 或 customQuoteId 不能同时为空');
    }

    const existing = await prisma.recitePlan.findFirst({
        where: {
            userId,
            quoteId: input.quoteId ?? undefined,
            customQuoteId: input.customQuoteId ?? undefined,
        },
    });

    if (existing) {
        return toPlanItem(existing);
    }

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + EBBINGHAUS[0]);

    const plan = await prisma.recitePlan.create({
        data: {
            userId,
            quoteId: input.quoteId,
            customQuoteId: input.customQuoteId,
            currentStage: 0,
            nextReviewAt,
        },
    });

    return toPlanItem(plan);
}

async function todayReview(userId: number): Promise<PlanItem[]> {
    const now = new Date();
    const plans = await prisma.recitePlan.findMany({
        where: { userId, nextReviewAt: { lte: now } },
        orderBy: { nextReviewAt: 'asc' },
    });

    return plans.map(toPlanItem);
}

async function review(
    planId: number,
    userId: number,
    action: 'master' | 'not_skilled' | 'skip'
): Promise<PlanItem> {
    const plan = await prisma.recitePlan.findUnique({ where: { id: planId } });
    if (!plan) throw new BusinessError(404, '背诵计划不存在');
    if (plan.userId !== userId) throw new BusinessError(403, '无权操作');

    let newStage = plan.currentStage;
    let masterLevel = plan.masterLevel;

    if (action === 'master') {
        newStage = Math.min(plan.currentStage + 1, EBBINGHAUS.length - 1);
        masterLevel = Math.min(masterLevel + 1, EBBINGHAUS.length);
    } else if (action === 'not_skilled') {
        newStage = Math.max(plan.currentStage - 1, 0);
    }

    const now = new Date();
    const days = EBBINGHAUS[newStage] ?? EBBINGHAUS[EBBINGHAUS.length - 1];
    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + days);

    const [updated] = await prisma.$transaction([
        prisma.recitePlan.update({
            where: { id: planId },
            data: {
                currentStage: newStage,
                lastReviewAt: now,
                nextReviewAt,
                masterLevel,
            },
        }),
        prisma.reciteLog.create({
            data: {
                userId,
                planId,
                action,
                reviewDate: now,
            },
        }),
    ]);

    return toPlanItem(updated);
}

async function stats(userId: number): Promise<{
    total: number;
    todayCount: number;
    masteredCount: number;
    calendar: Record<string, number>;
}> {
    const now = new Date();
    const todayStr = formatDate(now);

    const [total, todayCount, masteredCount, logs] = await Promise.all([
        prisma.recitePlan.count({ where: { userId } }),
        prisma.reciteLog.count({
            where: { userId, reviewDate: { gte: startOfDay(now) } },
        }),
        prisma.recitePlan.count({
            where: { userId, masterLevel: { gte: EBBINGHAUS.length - 1 } },
        }),
        prisma.reciteLog.findMany({
            where: { userId },
            select: { reviewDate: true },
        }),
    ]);

    const calendar: Record<string, number> = {};
    for (const log of logs) {
        const key = formatDate(log.reviewDate);
        calendar[key] = (calendar[key] ?? 0) + 1;
    }

    return { total, todayCount, masteredCount, calendar };
}

function toPlanItem(p: {
    id: number;
    userId: number;
    quoteId?: number | null;
    customQuoteId?: number | null;
    currentStage: number;
    nextReviewAt: Date;
    lastReviewAt?: Date | null;
    masterLevel: number;
    createdAt: Date;
}): PlanItem {
    return {
        id: p.id,
        userId: p.userId,
        quoteId: p.quoteId ?? undefined,
        customQuoteId: p.customQuoteId ?? undefined,
        currentStage: p.currentStage,
        nextReviewAt: p.nextReviewAt.toISOString(),
        lastReviewAt: p.lastReviewAt?.toISOString(),
        masterLevel: p.masterLevel,
        createdAt: p.createdAt.toISOString(),
    };
}

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

export { EBBINGHAUS, list, add, todayReview, review, stats };
