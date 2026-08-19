import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

async function get(key: string, fallback?: string): Promise<string | undefined> {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? fallback;
}

async function set(key: string, value: string, remark?: string): Promise<void> {
    await prisma.systemConfig.upsert({
        where: { key },
        create: { key, value, remark: remark ?? null },
        update: { value, ...(remark !== undefined ? { remark } : {}) },
    });
}

async function list(): Promise<Array<{ key: string; value: string; remark: string | null }>> {
    return prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
}

async function batchUpdate(items: Array<{ key: string; value: string; remark?: string }>): Promise<void> {
    for (const item of items) {
        if (!item.key) continue;
        await set(item.key, String(item.value), item.remark);
    }
}

async function ensureDefaults(): Promise<void> {
    const defaults: Array<[string, string, string]> = [
        ['default_trial_days', '7', '新用户默认试用天数'],
    ];
    for (const [key, value, remark] of defaults) {
        await prisma.systemConfig.upsert({
            where: { key },
            create: { key, value, remark },
            update: {},
        });
    }
}

async function listPaymentConfigs(): Promise<any[]> {
    return prisma.paymentConfig.findMany();
}

async function upsertPaymentConfig(data: {
    payChannel: string;
    appId?: string;
    mchId?: string;
    apiKey?: string;
    notifyUrl?: string;
    isActive?: boolean;
    remark?: string;
}): Promise<any> {
    if (!data.payChannel) throw new BusinessError(400, 'payChannel 不能为空');

    return prisma.paymentConfig.upsert({
        where: { payChannel: data.payChannel },
        create: {
            payChannel: data.payChannel,
            appId: data.appId ?? null,
            mchId: data.mchId ?? null,
            apiKey: data.apiKey ?? null,
            notifyUrl: data.notifyUrl ?? null,
            isActive: data.isActive ?? true,
            remark: data.remark ?? null,
        },
        update: {
            appId: data.appId,
            mchId: data.mchId,
            apiKey: data.apiKey,
            notifyUrl: data.notifyUrl,
            isActive: data.isActive,
            remark: data.remark,
        },
    });
}

export { get, set, list, batchUpdate, ensureDefaults, listPaymentConfigs, upsertPaymentConfig };
export default { get, set, list, batchUpdate, ensureDefaults, listPaymentConfigs, upsertPaymentConfig };
