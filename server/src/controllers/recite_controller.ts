import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as recitePlanService from '@/services/recite_plan_service';

function getUserId(req: AuthRequest): string | null {
  return req.userId || null;
}

function toUserIdInt(userId: string | null): number | null {
  if (!userId) return null;
  const n = Number(userId);
  return Number.isNaN(n) ? null : n;
}

export const list = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await recitePlanService.list(userId);
  ok(res, result);
});

export const add = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { quoteId, customQuoteId } = req.body as { quoteId?: number; customQuoteId?: number };
  const result = await recitePlanService.add(userId, { quoteId, customQuoteId });
  ok(res, result);
});

export const today = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await recitePlanService.todayReview(userId);
  ok(res, result);
});

export const review = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { planId, quality } = req.body as { planId?: number; quality?: number };
  if (!planId) { error(res, 400, 'Missing planId', 400); return; }
  const action = quality && quality >= 4 ? 'master' : (quality && quality <= 2 ? 'not_skilled' : 'master');
  const result = await recitePlanService.review(planId, userId, action);
  ok(res, result);
});

export const calendar = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const all = await recitePlanService.stats(userId);
  const { year, month } = req.query as { year?: string; month?: string };
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const prefix = `${y}-${String(m).padStart(2, '0')}`;
  const days = Object.keys(all.calendar)
    .filter(k => k.startsWith(prefix))
    .map(k => Number(k.slice(-2)));
  ok(res, days);
});

export const stats = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await recitePlanService.stats(userId);
  ok(res, result);
});

export const remove = catchAsync(async (req, res) => {
  const userId = toUserIdInt(getUserId(req as AuthRequest));
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const id = Number(req.params.id);
  ok(res, { msg: 'placeholder, use prisma recitePlan.delete' });
});
