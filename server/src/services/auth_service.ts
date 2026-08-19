import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { UserInfo } from '@/types';
import jwt from '@/utils/jwt';
import config from '@/config';
import { hashPassword, verifyPassword } from '@/utils/password';
import { computeUserRights, getDefaultTrialDays } from '@/utils/user_rights';

const prisma = new PrismaClient();

const DEV_OPEN_ID_PREFIX = 'dev_openid_';

function buildUserInfo(user: any): UserInfo {
    const userType = user.userType ?? 'wechat';
    const rights = computeUserRights({
        openId: user.openId,
        status: user.status,
        userType,
        memberLevel: user.memberLevel,
        memberExpireAt: user.memberExpireAt,
        trialExpireAt: user.trialExpireAt,
    });

    return {
        id: String(user.id),
        openId: user.openId,
        username: user.username ?? undefined,
        nickname: user.nickname ?? undefined,
        avatar: user.avatar ?? undefined,
        userType,
        isAdmin: userType === 'admin',
        memberLevel: rights.memberLevel,
        isPaidMember: rights.isPaidMember,
        isTrialActive: rights.isTrialActive,
        trialExpireAt: rights.trialExpireAt?.toISOString(),
        memberExpireDate: user.memberExpireAt?.toISOString(),
        canUseFeature: rights.canUseFeature,
        isBanned: rights.isBanned,
    };
}

function signAndReturn(user: any) {
    const token = jwt.sign({ userId: String(user.id), openId: user.openId }, config.jwtSecret, config.jwtExpiresIn);
    const expiresInSec = parseExpiresInToSeconds(config.jwtExpiresIn);
    return { token, expiresIn: expiresInSec, user: buildUserInfo(user) };
}

async function wechatLogin(code?: string): Promise<{ token: string; expiresIn: number; user: UserInfo }> {
    let openId: string;

    if (config.nodeEnv !== 'production') {
        openId = code ? `${DEV_OPEN_ID_PREFIX}${code}` : `${DEV_OPEN_ID_PREFIX}guest`;
    } else {
        if (!code) {
            throw new BusinessError(400, '微信登录 code 不能为空');
        }
        openId = code;
    }

    let user = await prisma.user.findUnique({ where: { openId } });

    if (!user) {
        const trialDays = await getDefaultTrialDays();
        const trialExpireAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
        user = await prisma.user.create({
            data: {
                openId,
                userType: 'wechat',
                trialExpireAt,
                lastLoginAt: new Date(),
            },
        });
    } else {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
    }

    return signAndReturn(user);
}

async function register(username: string, password: string, nickname?: string): Promise<{ token: string; expiresIn: number; user: UserInfo }> {
    if (!username || !password) throw new BusinessError(400, '账号和密码不能为空');
    if (username.length < 3 || username.length > 32) throw new BusinessError(400, '账号长度应在 3-32 之间');
    if (password.length < 6 || password.length > 64) throw new BusinessError(400, '密码长度应在 6-64 之间');

    const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { openId: username }] },
    });
    if (existing) throw new BusinessError(409, '账号已存在');

    const trialDays = await getDefaultTrialDays();
    const trialExpireAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const openId = `account_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const user = await prisma.user.create({
        data: {
            openId,
            username,
            passwordHash: hashPassword(password),
            nickname: nickname || username,
            userType: 'account',
            trialExpireAt,
            lastLoginAt: new Date(),
        },
    });

    return signAndReturn(user);
}

async function login(username: string, password: string): Promise<{ token: string; expiresIn: number; user: UserInfo }> {
    if (!username || !password) throw new BusinessError(400, '账号和密码不能为空');

    const user = await prisma.user.findFirst({ where: { username } });
    if (!user || !user.passwordHash) throw new BusinessError(401, '账号或密码错误');

    if (!verifyPassword(password, user.passwordHash)) {
        throw new BusinessError(401, '账号或密码错误');
    }

    if (user.status === 0) throw new BusinessError(403, '账号已被封禁');

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    return signAndReturn(updated);
}

async function logout(userId: string | number): Promise<void> {
    const uid = Number(userId);
    if (!uid || Number.isNaN(uid)) {
        throw new BusinessError(400, '非法的用户 ID');
    }

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
        throw new BusinessError(404, '用户不存在');
    }

    await prisma.syncRecord.create({
        data: {
            userId: uid,
            tableName: 'User',
            recordId: uid,
            action: 'logout',
        },
    });
}

async function refresh(token: string): Promise<{ token: string; openId: string }> {
    let payload;
    try {
        payload = jwt.verify(token, config.jwtSecret);
    } catch (err) {
        throw new BusinessError(401, '无效或已过期的 token');
    }

    const userId = Number(payload.userId);
    if (!userId || Number.isNaN(userId)) {
        throw new BusinessError(401, '无效的 token 载荷');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new BusinessError(404, '用户不存在');
    }

    const newToken = jwt.sign(
        { userId: String(user.id), openId: user.openId },
        config.jwtSecret,
        config.jwtExpiresIn,
    );

    return { token: newToken, openId: user.openId };
}

function parseExpiresInToSeconds(expiresIn: string | number): number {
    if (typeof expiresIn === 'number') return expiresIn;
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7200;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
        case 's': return val;
        case 'm': return val * 60;
        case 'h': return val * 3600;
        case 'd': return val * 86400;
        default: return 7200;
    }
}

export { wechatLogin, register, login, logout, refresh, buildUserInfo };
