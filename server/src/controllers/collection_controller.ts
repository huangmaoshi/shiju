import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as collectionService from '@/services/collection_service';

function getUserId(req: AuthRequest): string | null {
  return req.userId || null;
}

export const list = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await collectionService.list(userId);
  ok(res, result);
});

export const create = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) { error(res, 400, 'Missing name', 400); return; }
  const result = await collectionService.create(userId, { name, description });
  ok(res, result);
});

export const rename = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const id = Number(req.params.id);
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name && description === undefined) { error(res, 400, 'Missing name or description', 400); return; }
  const result = await collectionService.update(userId, id, name, description);
  ok(res, result);
});

export const remove = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const id = Number(req.params.id);
  await collectionService.remove(userId, id);
  ok(res, null);
});

export const getQuotes = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const collectionId = Number(req.params.id);
  const { page, pageSize } = req.query as { page?: string; pageSize?: string };
  const result = await collectionService.getQuotes(userId, collectionId, Number(page) || 1, Number(pageSize) || 20);
  ok(res, result);
});

export const addQuote = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const collectionId = Number(req.params.id);
  const { quoteId, customQuoteId } = req.body as { quoteId?: number; customQuoteId?: number };
  const result = await collectionService.addQuote(userId, collectionId, { quoteId, customQuoteId });
  ok(res, result);
});

export const removeQuote = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const collectionId = Number(req.params.id);
  const recordId = Number(req.params.recordId);
  await collectionService.removeQuote(userId, collectionId, recordId);
  ok(res, null);
});

export const collectQuote = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const quoteId = Number(req.params.quoteId);
  const result = await collectionService.collectQuote(userId, quoteId);
  ok(res, result);
});

export const uncollectQuote = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const quoteId = Number(req.params.quoteId);
  await collectionService.uncollectQuote(userId, quoteId);
  ok(res, null);
});

export const stats = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await collectionService.stats(userId);
  ok(res, result);
});
