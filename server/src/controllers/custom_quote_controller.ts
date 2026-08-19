import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as customQuoteService from '@/services/custom_quote_service';

function getUserId(req: AuthRequest): string | null {
  return req.userId || null;
}

export const list = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { page, pageSize } = req.query as { page?: string; pageSize?: string };
  const result = await customQuoteService.list(userId, Number(page) || 1, Number(pageSize) || 20);
  ok(res, result);
});

export const create = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { content, author, source, note, tags } = req.body as { content?: string; author?: string; source?: string; note?: string; tags?: string };
  if (!content) { error(res, 400, 'Missing content', 400); return; }
  const result = await customQuoteService.create(userId, { content, author, source, note, tags });
  ok(res, result);
});

export const update = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const id = Number(req.params.id);
  const data = req.body as { content?: string; author?: string; source?: string; note?: string; tags?: string };
  const result = await customQuoteService.update(userId, id, data);
  ok(res, result);
});

export const remove = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const id = Number(req.params.id);
  await customQuoteService.remove(userId, id);
  ok(res, null);
});

export const getQuota = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await customQuoteService.getQuota(userId);
  ok(res, result);
});
