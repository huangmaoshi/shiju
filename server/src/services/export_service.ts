import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function buildTxt(items: { content: string; author: string; source: string }[]): Promise<string> {
    return items
        .map((item) => {
            let s = item.content;
            if (item.author) s += '\n—— ' + item.author;
            if (item.source) s += '《' + item.source + '》';
            return s;
        })
        .join('\n\n' + '—'.repeat(30) + '\n\n');
}

async function buildPdf(items: { content: string; author: string; source: string }[], title: string): Promise<Buffer> {
    try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        const endPromise = new Promise<Buffer>((resolve) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
        });

        doc.fontSize(22).text(title, { align: 'center' });
        doc.moveDown();

        for (const item of items) {
            doc.fontSize(14).text(item.content);
            if (item.author || item.source) {
                doc.fontSize(10).fillColor('#666');
                let footer = '';
                if (item.author) footer += '—— ' + item.author;
                if (item.source) footer += ' 《' + item.source + '》';
                doc.text(footer.trim());
                doc.fillColor('#000');
            }
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
            doc.moveDown();
        }

        doc.end();
        return await endPromise;
    } catch (err) {
        throw new BusinessError(500, 'PDF 生成失败，请安装 pdfkit: npm install pdfkit');
    }
}

async function exportCollection(
    userId: string,
    collectionId: number,
    format: 'txt' | 'pdf'
): Promise<{ mime: string; filename: string; buffer: Buffer }> {
    const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collection || String(collection.userId) !== userId) {
        throw new BusinessError(404, '收藏夹不存在');
    }

    const records = await prisma.collectionQuote.findMany({
        where: { collectionId },
        include: {
            quote: true,
            customQuote: true,
        },
        orderBy: { addedAt: 'asc' },
    });

    const items = records
        .map((r) => {
            if (r.quote) {
                return {
                    content: r.quote.content,
                    author: r.quote.author ?? '',
                    source: r.quote.source ?? '',
                };
            }
            if (r.customQuote) {
                return {
                    content: r.customQuote.content,
                    author: r.customQuote.author ?? '',
                    source: r.customQuote.source ?? '',
                };
            }
            return null;
        })
        .filter((x): x is { content: string; author: string; source: string } => x !== null);

    let buffer: Buffer;
    let mime: string;

    if (format === 'txt') {
        const content = await buildTxt(items);
        buffer = Buffer.from(content, 'utf-8');
        mime = 'text/plain; charset=utf-8';
    } else if (format === 'pdf') {
        buffer = await buildPdf(items, collection.name);
        mime = 'application/pdf';
    } else {
        throw new BusinessError(400, '不支持的导出格式');
    }

    const filename = `${collection.name}_${Date.now()}.${format}`;
    return { mime, filename, buffer };
}

async function exportCustom(
    userId: string,
    format: 'txt' | 'pdf'
): Promise<{ mime: string; filename: string; buffer: Buffer }> {
    const uid = Number(userId);
    if (Number.isNaN(uid)) {
        throw new BusinessError(400, '无效的用户 ID');
    }

    const customs = await prisma.customQuote.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'asc' },
    });

    const items = customs.map((c) => ({
        content: c.content,
        author: c.author ?? '',
        source: c.source ?? '',
    }));

    let buffer: Buffer;
    let mime: string;

    if (format === 'txt') {
        const content = await buildTxt(items);
        buffer = Buffer.from(content, 'utf-8');
        mime = 'text/plain; charset=utf-8';
    } else if (format === 'pdf') {
        buffer = await buildPdf(items, '我的自定义句子');
        mime = 'application/pdf';
    } else {
        throw new BusinessError(400, '不支持的导出格式');
    }

    const filename = `自定义句子_${Date.now()}.${format}`;
    return { mime, filename, buffer };
}

export { exportCollection, exportCustom };
