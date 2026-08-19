import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { CustomQuoteInput, PageResult } from '@/types';
import memberService from './member_service';

const prisma = new PrismaClient();

const FREE_QUOTA = 50;

async function list(
    userId: number,
    page: number,
    pageSize: number
): Promise<PageResult<CustomQuoteItem>> {
    const skip = (page - 1) * pageSize;

    const [total, records] = await Promise.all([
        prisma.customQuote.count({ where: { userId } }),
        prisma.customQuote.findMany({
            where: { userId },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    const list: CustomQuoteItem[] = records.map((r) => ({
        id: String(r.id),
        content: r.content,
        author: r.author ?? undefined,
        source: r.source ?? undefined,
        note: r.note ?? undefined,
        tags: r.tags ?? undefined,
        createdAt: r.createdAt.toISOString(),
    }));

    return { total, list };
}

interface CustomQuoteItem {
    id: string;
    content: string;
    author?: string;
    source?: string;
    note?: string;
    tags?: string;
    createdAt: string;
}

async function create(userId: number, input: CustomQuoteInput): Promise<CustomQuoteItem> {
    const quota = await getQuota(userId);
    if (quota.remaining <= 0) {
        throw new BusinessError(403, '自定义名句数量已达上限，请开通会员');
    }

    const record = await prisma.customQuote.create({
        data: {
            userId,
            content: input.content,
            author: input.author,
            source: input.sourceName,
            note: input.note,
            tags: input.categoryIds?.join(','),
        },
    });

    return {
        id: String(record.id),
        content: record.content,
        author: record.author ?? undefined,
        source: record.source ?? undefined,
        note: record.note ?? undefined,
        tags: record.tags ?? undefined,
        createdAt: record.createdAt.toISOString(),
    };
}

async function update(
    userId: number,
    id: number,
    input: CustomQuoteInput
): Promise<CustomQuoteItem> {
    const existing = await prisma.customQuote.findUnique({ where: { id } });
    if (!existing) throw new BusinessError(404, '自定义名句不存在');
    if (existing.userId !== userId) throw new BusinessError(403, '无权操作');

    const updated = await prisma.customQuote.update({
        where: { id },
        data: {
            content: input.content,
            author: input.author,
            source: input.sourceName,
            note: input.note,
            tags: input.categoryIds?.join(','),
        },
    });

    return {
        id: String(updated.id),
        content: updated.content,
        author: updated.author ?? undefined,
        source: updated.source ?? undefined,
        note: updated.note ?? undefined,
        tags: updated.tags ?? undefined,
        createdAt: updated.createdAt.toISOString(),
    };
}

async function remove(userId: number, id: number): Promise<void> {
    const existing = await prisma.customQuote.findUnique({ where: { id } });
    if (!existing) throw new BusinessError(404, '自定义名句不存在');
    if (existing.userId !== userId) throw new BusinessError(403, '无权操作');

    await prisma.customQuote.delete({ where: { id } });
}

async function getQuota(userId: number): Promise<{ total: number; used: number; remaining: number }> {
    const isMember = await memberService.checkIsMember(userId);

    const used = await prisma.customQuote.count({ where: { userId } });
    const total = isMember ? Infinity : FREE_QUOTA;
    const remaining = isMember ? Infinity : Math.max(0, FREE_QUOTA - used);

    return { total, used, remaining };
}

export { list, create, update, remove, getQuota };
