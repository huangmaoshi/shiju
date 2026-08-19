import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

interface AdConfigItem {
    id: number;
    position: string;
    adType: string;
    adUnitId: string;
    platform: string;
    frequency: number;
    priority: number;
}

async function getConfigs(position: string, platform?: string): Promise<AdConfigItem[]> {
    const where: any = { status: 1, position };
    if (platform) where.platform = platform;

    const configs = await prisma.adConfig.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    });

    return configs.map((c) => ({
        id: c.id,
        position: c.position,
        adType: c.adType,
        adUnitId: c.adUnitId,
        platform: c.platform,
        frequency: c.frequency,
        priority: c.priority,
    }));
}

async function impression(userId: string, adUnitId: string): Promise<void> {
    const exists = await prisma.adConfig.findFirst({
        where: { adUnitId, status: 1 },
    });
    if (!exists) {
        throw new BusinessError(404, '广告位不存在或已禁用');
    }
}

async function click(userId: string, adUnitId: string): Promise<void> {
    const exists = await prisma.adConfig.findFirst({
        where: { adUnitId, status: 1 },
    });
    if (!exists) {
        throw new BusinessError(404, '广告位不存在或已禁用');
    }
}

async function rewardVerify(
    userId: string,
    adUnitId: string,
    rewardToken: string,
): Promise<{ success: boolean; rewardUnitId: string; verified: boolean }> {
    const ad = await prisma.adConfig.findFirst({
        where: { adUnitId, status: 1 },
    });
    if (!ad) {
        throw new BusinessError(404, '广告位不存在或已禁用');
    }

    if (!rewardToken) {
        throw new BusinessError(400, 'rewardToken 不能为空');
    }

    return {
        success: true,
        rewardUnitId: adUnitId,
        verified: true,
    };
}

export { getConfigs, impression, click, rewardVerify };
