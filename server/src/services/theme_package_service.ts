import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

interface ThemePackageItem {
    id: number;
    name: string;
    description?: string;
    coverUrl?: string;
    quoteIds: string;
    isMember: number;
    adUnlockDays: number;
    expireDate?: string;
}

async function list(): Promise<ThemePackageItem[]> {
    const items = await prisma.themePackage.findMany({
        where: { status: 1 },
        orderBy: { id: 'asc' },
    });

    return items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? undefined,
        coverUrl: i.coverUrl ?? undefined,
        quoteIds: i.quoteIds,
        isMember: i.isMember,
        adUnlockDays: i.adUnlockDays,
        expireDate: i.expireDate?.toISOString(),
    }));
}

async function getById(id: number): Promise<ThemePackageItem | null> {
    const item = await prisma.themePackage.findUnique({ where: { id } });
    if (!item || item.status !== 1) return null;

    return {
        id: item.id,
        name: item.name,
        description: item.description ?? undefined,
        coverUrl: item.coverUrl ?? undefined,
        quoteIds: item.quoteIds,
        isMember: item.isMember,
        adUnlockDays: item.adUnlockDays,
        expireDate: item.expireDate?.toISOString(),
    };
}

export { list, getById };
