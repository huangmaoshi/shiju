import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import * as memberService from './member_service';

const prisma = new PrismaClient();

function generateOrderNo(): string {
    return 'SK' + Date.now() + Math.floor(Math.random() * 1000);
}

async function createOrder(
    userId: number,
    planType: string
): Promise<{
    id: number;
    orderNo: string;
    planType: string;
    amount: number;
    payStatus: number;
    createdAt: string;
}> {
    const plans = await memberService.getPlans();
    const plan = plans[planType];
    if (!plan) {
        throw new BusinessError(400, '无效的套餐类型');
    }

    const orderNo = generateOrderNo();
    const order = await prisma.order.create({
        data: {
            userId,
            orderNo,
            planType,
            amount: plan.price,
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

async function getByOrderNo(orderNo: string) {
    return prisma.order.findUnique({ where: { orderNo } });
}

async function markPaid(orderNo: string): Promise<void> {
    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) throw new BusinessError(404, '订单不存在');
    if (order.payStatus === 1) return;

    await prisma.$transaction([
        prisma.order.update({
            where: { orderNo },
            data: { payStatus: 1, payTime: new Date() },
        }),
    ]);

    await memberService.activate(order.userId, order.planType);
}

export { generateOrderNo, createOrder, getByOrderNo, markPaid };
