import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { UserInfo } from '@/types';

const prisma = new PrismaClient();

async function upsertByOpenId(openId: string): Promise<UserInfo> {
    const user = await prisma.user.upsert({
        where: { openId },
        update: { lastLoginAt: new Date() },
        create: { openId },
        include: { member: true },
    });

    return {
        id: String(user.id),
        openId: user.openId,
        nickname: user.nickname ?? undefined,
        avatar: user.avatar ?? undefined,
        isMember: !!user.member && user.member.expireDate > new Date(),
        memberExpireDate: user.member?.expireDate?.toISOString(),
    };
}

async function getUserInfo(userId: number): Promise<UserInfo | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { member: true },
    });

    if (!user) return null;

    return {
        id: String(user.id),
        openId: user.openId,
        nickname: user.nickname ?? undefined,
        avatar: user.avatar ?? undefined,
        isMember: !!user.member && user.member.expireDate > new Date(),
        memberExpireDate: user.member?.expireDate?.toISOString(),
    };
}

export { upsertByOpenId, getUserInfo };
