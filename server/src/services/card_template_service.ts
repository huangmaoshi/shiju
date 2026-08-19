import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

interface CardTemplateItem {
    id: number;
    name: string;
    style: string;
    bgType: string;
    bgValue: string;
    fontFamily: string;
    fontSize: number;
    fontColor: string;
    lineHeight: number;
    textAlign: string;
    showAuthor: number;
    showWatermark: number;
    isMember: number;
    previewUrl?: string;
}

async function list(isMember?: boolean): Promise<CardTemplateItem[]> {
    const where: any = { status: 1 };
    if (isMember !== undefined) where.isMember = isMember ? 1 : 0;

    const templates = await prisma.cardTemplate.findMany({
        where,
        orderBy: { id: 'asc' },
    });

    return templates.map(toItem);
}

async function getById(id: number): Promise<CardTemplateItem | null> {
    const tpl = await prisma.cardTemplate.findUnique({ where: { id } });
    if (!tpl || tpl.status !== 1) return null;
    return toItem(tpl);
}

function toItem(tpl: {
    id: number;
    name: string;
    style: string;
    bgType: string;
    bgValue: string;
    fontFamily: string;
    fontSize: number;
    fontColor: string;
    lineHeight: number;
    textAlign: string;
    showAuthor: number;
    showWatermark: number;
    isMember: number;
    previewUrl?: string | null;
}): CardTemplateItem {
    return {
        id: tpl.id,
        name: tpl.name,
        style: tpl.style,
        bgType: tpl.bgType,
        bgValue: tpl.bgValue,
        fontFamily: tpl.fontFamily,
        fontSize: tpl.fontSize,
        fontColor: tpl.fontColor,
        lineHeight: tpl.lineHeight,
        textAlign: tpl.textAlign,
        showAuthor: tpl.showAuthor,
        showWatermark: tpl.showWatermark,
        isMember: tpl.isMember,
        previewUrl: tpl.previewUrl ?? undefined,
    };
}

export { list, getById };
