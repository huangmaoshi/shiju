import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import * as originalTextService from '@/services/original_text_service';

export const list = catchAsync(async (req, res) => {
    const { keyword, categoryType, status, auditStatus, page, pageSize } = req.query as {
        keyword?: string;
        categoryType?: string;
        status?: string;
        auditStatus?: string;
        page?: string;
        pageSize?: string;
    };

    const result = await originalTextService.list({
        keyword,
        categoryType,
        status: status !== undefined && status !== '' ? Number(status) : undefined,
        auditStatus: auditStatus !== undefined && auditStatus !== '' ? Number(auditStatus) : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
    });
    ok(res, result);
});

export const getById = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
        error(res, 400, '无效的 ID', 400);
        return;
    }

    const { auditStatus } = req.query as { auditStatus?: string };
    const result = await originalTextService.getById(
        id,
        auditStatus !== undefined && auditStatus !== '' ? Number(auditStatus) : undefined
    );
    if (!result) {
        error(res, 404, '原文不存在', 404);
        return;
    }
    ok(res, result);
});

export const create = catchAsync(async (req, res) => {
    const body = req.body || {};
    if (!body.title || !body.content) {
        error(res, 400, '标题和内容为必填项', 400);
        return;
    }

    const result = await originalTextService.create(body);
    ok(res, result);
});

export const update = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
        error(res, 400, '无效的 ID', 400);
        return;
    }

    const body = req.body || {};
    const result = await originalTextService.update(id, body);
    ok(res, result);
});

export const remove = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
        error(res, 400, '无效的 ID', 400);
        return;
    }

    await originalTextService.remove(id);
    ok(res, null);
});

export const addQuote = catchAsync(async (req, res) => {
    const originalTextId = Number(req.params.id);
    if (!originalTextId || Number.isNaN(originalTextId)) {
        error(res, 400, '无效的原文 ID', 400);
        return;
    }

    const body = req.body || {};
    if (!body.content || typeof body.content !== 'string') {
        error(res, 400, '金句内容为必填项', 400);
        return;
    }

    const result = await originalTextService.addQuoteFromText(
        originalTextId,
        body.content,
        body.author,
        body.source
    );
    ok(res, result);
});
