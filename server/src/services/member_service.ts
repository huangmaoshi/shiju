import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { computeUserRights } from '@/utils/user_rights';

const prisma = new PrismaClient();

const DEFAULT_PLANS: Record<string, { name: string; price: number; days: number; memberLevel: number }> = {
    monthly: { name: '月卡', price: 9.9, days: 30, memberLevel: 1 },
    quarterly: { name: '季卡', price: 25.0, days: 90, memberLevel: 1 },
    yearly: { name: '包年', price: 88.0, days: 365, memberLevel: 2 },
};

async function getPlans() {
    // 未来可从 SystemConfig 覆盖价格，当前返回默认值
    return DEFAULT_PLANS;
}

async function getInfo(userId: number) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { member: true },
    });
    if (!user) return null;

    const rights = computeUserRights({
        openId: user.openId,
        status: user.status,
        memberLevel: user.memberLevel,
        memberExpireAt: user.memberExpireAt,
        trialExpireAt: user.trialExpireAt,
    });

    return {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        memberLevel: rights.memberLevel,
        isPaidMember: rights.isPaidMember,
        isTrialActive: rights.isTrialActive,
        trialExpireAt: rights.trialExpireAt?.toISOString(),
        memberExpireDate: user.memberExpireAt?.toISOString(),
        planType: user.member?.planType,
        canUseFeature: rights.canUseFeature,
    };
}

async function activate(userId: number, planType: string): Promise<void> {
    const plans = await getPlans();
    const plan = plans[planType];
    if (!plan) throw new BusinessError(400, '无效的套餐类型');

    const now = new Date();
    const future = new Date(now.getTime() + plan.days * 24 * 60 * 60 * 1000);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BusinessError(404, '用户不存在');

    // 计算新的 memberExpireAt：若当前会员未过期则续期
    let newExpireAt = future;
    if (user.memberExpireAt && user.memberExpireAt.getTime() > now.getTime()) {
        newExpireAt = new Date(user.memberExpireAt.getTime() + plan.days * 24 * 60 * 60 * 1000);
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: {
                memberLevel: plan.memberLevel,
                memberExpireAt: newExpireAt,
            },
        }),
        prisma.member.upsert({
            where: { userId },
            create: {
                userId,
                planType,
                startDate: now,
                expireDate: newExpireAt,
            },
            update: {
                planType,
                startDate: now,
                expireDate: newExpireAt,
                status: 1,
            },
        }),
    ]);
}

function generateOrderNo(): string {
    return 'SK' + Date.now() + Math.floor(Math.random() * 1000);
}

async function createOrder(
    userId: number,
    planType: string,
    payChannel = 'wechat',
): Promise<{ id: number; orderNo: string; planType: string; amount: number; payStatus: number; createdAt: string }> {
    const plans = await getPlans();
    const plan = plans[planType];
    if (!plan) throw new BusinessError(400, '无效的套餐类型');

    const orderNo = generateOrderNo();
    const order = await prisma.order.create({
        data: {
            userId,
            orderNo,
            planType,
            amount: plan.price,
            payChannel,
            payStatus: 0,
        },
    });

    return {
        id: order.id,
        orderNo: order.orderNo,
        planType: order.planType,
        amount: order.amount,
        payStatus: order.payStatus,
        createdAt: order.createdAt.toISOString(),
    };
}

async function markPaid(orderNo: string, payChannel?: string): Promise<void> {
    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) throw new BusinessError(404, '订单不存在');
    if (order.payStatus === 1) return;

    await prisma.order.update({
        where: { orderNo },
        data: {
            payStatus: 1,
            payTime: new Date(),
            ...(payChannel ? { payChannel } : {}),
        },
    });

    await activate(order.userId, order.planType);
}

export { getInfo, getPlans, activate, createOrder, markPaid };
export default { getInfo, getPlans, activate, createOrder, markPaid };
