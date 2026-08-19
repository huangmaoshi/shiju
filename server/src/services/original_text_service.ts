import { PrismaClient, Prisma } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import dedup from '@/utils/dedup';

const prisma = new PrismaClient();

interface ListParams {
    keyword?: string;
    categoryType?: string;
    status?: number;
    auditStatus?: number;
    page?: number;
    pageSize?: number;
}

interface OriginalTextSummary {
    id: string;
    title: string;
    author?: string;
    source?: string;
    categoryType?: string;
    summary?: string;
    wordCount: number;
    status: number;
    auditStatus?: number;
    quoteCount: number;
    createdAt: string;
    updatedAt: string;
}

interface OriginalTextDetail extends OriginalTextSummary {
    content: string;
    pinyinData?: string;
    sourceUrl?: string;
    tags?: string;
    provider?: string;
    complianceTag?: string;
    protocol?: string;
    quotes: Array<{
        id: string;
        content: string;
        author?: string;
        source?: string;
    }>;
}

interface PageResult<T> {
    total: number;
    list: T[];
}

function countWords(text: string): number {
    if (!text) return 0;
    const cleaned = text.replace(/\s+/g, '');
    return cleaned.length;
}

async function list(params: ListParams): Promise<PageResult<OriginalTextSummary>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OriginalTextWhereInput = {};

    if (params.auditStatus !== undefined && params.auditStatus !== null && !isNaN(params.auditStatus)) {
        where.auditStatus = params.auditStatus;
    }

    if (params.keyword) {
        where.OR = [
            { title: { contains: params.keyword } },
            { content: { contains: params.keyword } },
            { author: { contains: params.keyword } },
        ];
    }

    if (params.categoryType) {
        where.categoryType = params.categoryType;
    }

    if (params.status !== undefined && params.status !== null) {
        where.status = params.status;
    }

    const [total, records] = await Promise.all([
        prisma.originalText.count({ where }),
        prisma.originalText.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { id: 'desc' },
        }),
    ]);

    const list: OriginalTextSummary[] = records.map((r) => ({
        id: String(r.id),
        title: r.title,
        author: r.author ?? undefined,
        source: r.source ?? undefined,
        categoryType: r.categoryType ?? undefined,
        summary: r.summary ?? undefined,
        wordCount: r.wordCount,
        status: r.status,
        auditStatus: r.auditStatus ?? undefined,
        quoteCount: r.quoteCount,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));

    return { total, list };
}

async function getById(id: number, auditStatus?: number): Promise<OriginalTextDetail | null> {
    const where: Prisma.OriginalTextWhereInput = { id };
    if (auditStatus !== undefined && auditStatus !== null && !isNaN(auditStatus)) {
        where.auditStatus = auditStatus;
    }
    const record = await prisma.originalText.findUnique({
        where,
        include: {
            quotes: {
                select: {
                    id: true,
                    content: true,
                    author: true,
                    source: true,
                },
                orderBy: { id: 'asc' },
            },
        },
    });

    if (!record) return null;

    return {
        id: String(record.id),
        title: record.title,
        author: record.author ?? undefined,
        source: record.source ?? undefined,
        sourceUrl: record.sourceUrl ?? undefined,
        categoryType: record.categoryType ?? undefined,
        content: record.content,
        pinyinData: record.pinyinData ?? undefined,
        summary: record.summary ?? undefined,
        tags: record.tags ?? undefined,
        provider: record.provider ?? undefined,
        complianceTag: record.complianceTag ?? undefined,
        protocol: record.protocol ?? undefined,
        wordCount: record.wordCount,
        status: record.status,
        auditStatus: record.auditStatus ?? undefined,
        quoteCount: record.quoteCount,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        quotes: record.quotes.map((q) => ({
            id: String(q.id),
            content: q.content,
            author: q.author ?? undefined,
            source: q.source ?? undefined,
        })),
    };
}

async function create(data: {
    title: string;
    content: string;
    author?: string;
    source?: string;
    sourceUrl?: string;
    categoryType?: string;
    summary?: string;
    tags?: string;
    provider?: string;
    complianceTag?: string;
    protocol?: string;
    status?: number;
}): Promise<OriginalTextDetail> {
    const record = await prisma.originalText.create({
        data: {
            title: data.title,
            content: data.content,
            author: data.author ?? null,
            source: data.source ?? null,
            sourceUrl: data.sourceUrl ?? null,
            categoryType: data.categoryType ?? null,
            summary: data.summary ?? null,
            tags: data.tags ?? null,
            provider: data.provider ?? null,
            complianceTag: data.complianceTag ?? null,
            protocol: data.protocol ?? null,
            wordCount: countWords(data.content),
            status: data.status ?? 1,
        },
    });

    const detail = await getById(record.id);
    if (!detail) throw new BusinessError(500, '创建后查询失败');
    return detail;
}

async function update(
    id: number,
    data: {
        title?: string;
        content?: string;
        author?: string;
        source?: string;
        sourceUrl?: string;
        categoryType?: string;
        summary?: string;
        tags?: string;
        provider?: string;
        complianceTag?: string;
        protocol?: string;
        status?: number;
    }
): Promise<OriginalTextDetail> {
    const existing = await prisma.originalText.findUnique({ where: { id } });
    if (!existing) throw new BusinessError(404, '原文不存在');

    const updateData: Prisma.OriginalTextUpdateInput = {
        title: data.title,
        author: data.author !== undefined ? data.author : undefined,
        source: data.source !== undefined ? data.source : undefined,
        sourceUrl: data.sourceUrl !== undefined ? data.sourceUrl : undefined,
        categoryType: data.categoryType !== undefined ? data.categoryType : undefined,
        summary: data.summary !== undefined ? data.summary : undefined,
        tags: data.tags !== undefined ? data.tags : undefined,
        provider: data.provider !== undefined ? data.provider : undefined,
        complianceTag: data.complianceTag !== undefined ? data.complianceTag : undefined,
        protocol: data.protocol !== undefined ? data.protocol : undefined,
        status: data.status,
    };

    if (data.content !== undefined) {
        updateData.content = data.content;
        updateData.wordCount = countWords(data.content);
    }

    await prisma.originalText.update({ where: { id }, data: updateData });

    const detail = await getById(id);
    if (!detail) throw new BusinessError(500, '更新后查询失败');
    return detail;
}

async function remove(id: number): Promise<void> {
    const existing = await prisma.originalText.findUnique({ where: { id } });
    if (!existing) throw new BusinessError(404, '原文不存在');

    await prisma.$transaction(async (tx) => {
        await tx.quote.deleteMany({ where: { originalTextId: id } });
        await tx.originalText.delete({ where: { id } });
    });
}

async function addQuoteFromText(
    originalTextId: number,
    quoteContent: string,
    author?: string,
    source?: string
): Promise<{ id: string; content: string; author?: string; source?: string }> {
    const originalText = await prisma.originalText.findUnique({ where: { id: originalTextId } });
    if (!originalText) throw new BusinessError(404, '原文不存在');

    const trimmed = quoteContent.trim();
    if (!trimmed) throw new BusinessError(400, '金句内容不能为空');

    // 校验选段是否真的来自原文（允许前后各 5 字的宽松范围，因为清洗时可能有空白差异）
    if (!originalText.content.includes(trimmed)) {
        throw new BusinessError(400, '选段内容与原文不匹配，请检查是否从原文中选取');
    }

    const fp = dedup.fingerprint(trimmed);

    // 系统添加的金句要 MD5 去重
    const existingDup = await prisma.quote.findFirst({
        where: { contentMd5: fp.contentMd5 },
    });
    if (existingDup) {
        throw new BusinessError(409, `该金句已存在（#${existingDup.id}）`);
    }

    const quote = await prisma.$transaction(async (tx) => {
        const created = await tx.quote.create({
            data: {
                content: trimmed,
                contentMd5: fp.contentMd5,
                simHash: fp.simHash,
                author: author ?? originalText.author,
                source: source ?? originalText.source ?? originalText.title,
                sourceUrl: originalText.sourceUrl,
                originalTextId,
                wordCount: countWords(trimmed),
                isFree: true,
                isActive: true,
                provider: originalText.provider ?? 'admin',
                quoteType: 'admin',
                aiExtracted: false,
            },
        });

        await tx.originalText.update({
            where: { id: originalTextId },
            data: { quoteCount: { increment: 1 } },
        });

        return created;
    });

    return {
        id: String(quote.id),
        content: quote.content,
        author: quote.author ?? undefined,
        source: quote.source ?? undefined,
    };
}

export { list, getById, create, update, remove, addQuoteFromText };
