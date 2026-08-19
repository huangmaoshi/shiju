import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as searchService from '@/services/search_service';

export const searchQuotes = catchAsync(async (req, res) => {
  const { userId } = req as AuthRequest;
  const { keyword, page, pageSize } = req.query as { keyword?: string; page?: string; pageSize?: string };
  if (!keyword) {
    error(res, 400, 'Missing keyword', 400);
    return;
  }
  const result = await searchService.searchQuotes(userId, keyword, Number(page) || 1, Number(pageSize) || 20);
  ok(res, result);
});

export const searchOriginalText = catchAsync(async (req, res) => {
  const { keyword, page, pageSize } = req.query as { keyword?: string; page?: string; pageSize?: string };
  if (!keyword) {
    error(res, 400, 'Missing keyword', 400);
    return;
  }
  const result = await searchService.searchOriginalText(keyword, Number(page) || 1, Number(pageSize) || 20);
  ok(res, result);
});

export const getHot = catchAsync(async (_req, res) => {
  const result = await searchService.getHot();
  ok(res, result);
});

export const saveHistory = catchAsync(async (req, res) => {
  const { userId } = req as AuthRequest;
  const { keyword } = req.body as { keyword?: string };
  if (!userId) {
    error(res, 401, 'Unauthorized', 401);
    return;
  }
  if (!keyword) {
    error(res, 400, 'Missing keyword', 400);
    return;
  }
  await searchService.saveHistory(userId, keyword);
  ok(res, null);
});

export const clearHistory = catchAsync(async (req, res) => {
  const { userId } = req as AuthRequest;
  if (!userId) {
    error(res, 401, 'Unauthorized', 401);
    return;
  }
  await searchService.clearHistory(userId);
  ok(res, null);
});
