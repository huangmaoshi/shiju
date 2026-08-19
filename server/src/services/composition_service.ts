import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

interface CompositionItem {
    id: number;
    title: string;
    type: string;
    content: string;
    examples?: string;
    theme?: string;
    isFree: number;
}

async function list(isFree?: boolean): Promise<CompositionItem[]> {
    const where: any = { status: 1 };
    if (isFree !== undefined) where.isFree = isFree ? 1 : 0;

    const items = await prisma.compositionTemplate.findMany({
        where,
        orderBy: { id: 'asc' },
    });

    return items.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        content: i.content,
        examples: i.examples ?? undefined,
        theme: i.theme ?? undefined,
        isFree: i.isFree,
    }));
}

async function getById(id: number): Promise<CompositionItem | null> {
    const item = await prisma.compositionTemplate.findUnique({ where: { id } });
    if (!item || item.status !== 1) return null;

    return {
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content,
        examples: item.examples ?? undefined,
        theme: item.theme ?? undefined,
        isFree: item.isFree,
    };
}

export { list, getById };
