import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import { PrismaClient } from '@prisma/client';
import { buildUserInfo } from '@/services/auth_service';

const prisma = new PrismaClient();

/** 获取当前登录用户信息 */
export const getMe = catchAsync(async (req, res) => {
    const userId = Number((req as AuthRequest).userId);
    if (!userId) {
        return ok(res, null);
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return ok(res, null);
    }
    ok(res, buildUserInfo(user));
});
