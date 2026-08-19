import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type UserRights = {
    isWechatLoggedIn: boolean;
    isPaidMember: boolean;        // 付费会员（普通/高级）
    memberLevel: number;           // 0/1/2
    isTrialActive: boolean;        // 试用中
    trialExpireAt: Date | null;
    canUseFeature: boolean;        // 是否可用功能（会员或试用中）
    isBanned: boolean;
};

export function computeUserRights(params: {
    openId?: string | null;
    status?: number;
    userType?: string | null;
    memberLevel?: number;
    memberExpireAt?: Date | null;
    trialExpireAt?: Date | null;
}): UserRights {
    const now = new Date();

    const isWechatLoggedIn = !!params.openId;
    const isBanned = params.status === 0;

    // 管理员拥有所有权限，不区分会员等级与试用期
    const isAdmin = params.userType === 'admin';
    if (isAdmin) {
        return {
            isWechatLoggedIn,
            isPaidMember: true,
            memberLevel: 2, // 最高等级
            isTrialActive: false,
            trialExpireAt: null,
            canUseFeature: !isBanned,
            isBanned,
        };
    }

    const memberLevel = params.memberLevel ?? 0;
    const memberExpireAt = params.memberExpireAt ?? null;
    const trialExpireAt = params.trialExpireAt ?? null;

    // 付费会员：等级 > 0 且未过期
    const isPaidMember = memberLevel > 0 && !!memberExpireAt && memberExpireAt.getTime() > now.getTime();

    // 试用：trialExpireAt 存在且未过期
    const isTrialActive = !!trialExpireAt && trialExpireAt.getTime() > now.getTime();

    const canUseFeature = !isBanned && (isPaidMember || isTrialActive);

    return {
        isWechatLoggedIn,
        isPaidMember,
        memberLevel: isPaidMember ? memberLevel : 0,
        isTrialActive,
        trialExpireAt,
        canUseFeature,
        isBanned,
    };
}

async function getDefaultTrialDays(): Promise<number> {
    const cfg = await prisma.systemConfig.findUnique({ where: { key: 'default_trial_days' } });
    if (!cfg) return 7;
    const n = parseInt(cfg.value, 10);
    return Number.isFinite(n) && n > 0 ? n : 7;
}

export { getDefaultTrialDays };
