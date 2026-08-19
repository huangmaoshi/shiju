import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import * as compositionService from '@/services/composition_service';

export const list = catchAsync(async (req, res) => {
  const { type, page, pageSize } = req.query as { type?: string; page?: string; pageSize?: string };
  const result = await compositionService.list({ type, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
  ok(res, result);
});

export const getById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await compositionService.getById(id);
  ok(res, result);
});
