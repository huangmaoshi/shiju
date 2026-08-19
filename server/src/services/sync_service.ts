import { PrismaClient, Prisma } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

const TABLE_MAP: Record<string, keyof typeof prisma> = {
    collections: 'collection',
    customQuotes: 'customQuote',
    recitePlans: 'recitePlan',
};

interface ChangeItem {
    action: 'upsert' | 'delete';
    data: any;
}

interface PullResult {
    serverTime: string;
    changes: Record<string, ChangeItem[]>;
}

async function pull(
    userId: number,
    lastSyncAt: string | Date | null,
    deviceId?: string
): Promise<PullResult> {
    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);

    const records = await prisma.syncRecord.findMany({
        where: {
            userId,
            syncAt: { gt: since },
            ...(deviceId ? { deviceId: { not: deviceId } } : {}),
        },
        orderBy: { syncAt: 'asc' },
    });

    const changes: Record<string, ChangeItem[]> = {};

    for (const record of records) {
        const key = record.tableName;
        if (!changes[key]) changes[key] = [];

        changes[key].push({
            action: record.action as 'upsert' | 'delete',
            data: { id: record.recordId },
        });
    }

    for (const key of Object.keys(changes)) {
        changes[key] = dedupeChanges(changes[key]);
    }

    return {
        serverTime: new Date().toISOString(),
        changes,
    };
}

function dedupeChanges(list: ChangeItem[]): ChangeItem[] {
    const map = new Map<string, ChangeItem>();
    for (const item of list) {
        const id = String(item.data.id);
        map.set(id, item);
    }
    return Array.from(map.values());
}

async function push(
    userId: number,
    changes: Record<string, ChangeItem[]>,
    deviceId?: string
): Promise<{ synced: number; serverTime: string }> {
    let synced = 0;

    for (const [tableName, items] of Object.entries(changes)) {
        const prismaModelName = TABLE_MAP[tableName];
        if (!prismaModelName) continue;

        const model = (prisma as any)[prismaModelName];
        if (!model) continue;

        for (const item of items) {
            if (item.action === 'upsert') {
                const { id, ...rest } = item.data;
                if (id && typeof model.upsert === 'function') {
                    await model.upsert({
                        where: { id },
                        update: rest,
                        create: { id, ...rest, userId },
                    });
                } else if (typeof model.create === 'function') {
                    await model.create({
                        data: { ...item.data, userId },
                    });
                }
            } else if (item.action === 'delete') {
                if (typeof model.delete === 'function' && item.data?.id) {
                    try {
                        await model.delete({ where: { id: item.data.id } });
                    } catch (_) {}
                }
            }

            await prisma.syncRecord.create({
                data: {
                    userId,
                    tableName,
                    recordId: item.data?.id ?? 0,
                    action: item.action,
                    deviceId,
                },
            });

            synced++;
        }
    }

    return { synced, serverTime: new Date().toISOString() };
}

async function batchPush(
    userId: number,
    payload: { changes: Record<string, ChangeItem[]>; deviceId?: string }
): Promise<{ synced: number; serverTime: string }> {
    return push(userId, payload.changes, payload.deviceId);
}

export { pull, push, batchPush };
