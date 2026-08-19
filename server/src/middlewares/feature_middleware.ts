import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { error } from '@/utils/response';
import { AuthRequest } from './auth_middleware';
import { computeUserRights } from '@/utils/user_rights';

const prisma = new PrismaClient();

async function featureRequired(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.userId ? Number(req.userId) : 0;
    if (!userId) {
        error(res, 401, '未登录', 401);
        return;
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            openId: true,
            status: true,
            memberLevel: true,
            memberExpireAt: true,
            trialExpireAt: true,
        },
    });

    if (!user) {
        error(res, 404, '用户不存在', 404);
        return;
    }

    const rights = computeUserRights(user);

    if (rights.isBanned) {
        error(res, 403, '账号已被封禁', 403);
        return;
    }

    if (!rights.canUseFeature) {
        error(res, 402, '试用已结束，请开通会员后继续使用', 402);
        return;
    }

    (req as any).userRights = rights;
    next();
}

async function memberRequired(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.userId ? Number(req.userId) : 0;
    if (!userId) {
        error(res, 401, '未登录', 401);
        return;
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            openId: true,
            status: true,
            memberLevel: true,
            memberExpireAt: true,
            trialExpireAt: true,
        },
    });

    if (!user) {
        error(res, 404, '用户不存在', 404);
        return;
    }

    const rights = computeUserRights(user);

    if (!rights.isPaidMember) {
        error(res, 402, '该功能需要付费会员', 402);
        return;
    }

    (req as any).userRights = rights;
    next();
}

export { featureRequired, memberRequired };
export default { featureRequired, memberRequired };
