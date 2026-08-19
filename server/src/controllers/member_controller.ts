import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as memberService from '@/services/member_service';
import * as orderService from '@/services/order_service';

function toUserIdInt(userId: string | null): number | null {
  if (!userId) return null;
  const n = Number(userId);
  return Number.isNaN(n) ? null : n;
}

export const getInfo = catchAsync(async (req, res) => {
  const userId = toUserIdInt((req as AuthRequest).userId);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const result = await memberService.getInfo(userId);
  ok(res, result);
});

export const getPlans = catchAsync(async (_req, res) => {
  const result = await memberService.getPlans();
  ok(res, result);
});

export const createOrder = catchAsync(async (req, res) => {
  const userId = toUserIdInt((req as AuthRequest).userId);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { planType, payChannel } = req.body as { planType?: string; payChannel?: string };
  if (!planType) { error(res, 400, 'Missing planType', 400); return; }
  const result = await memberService.createOrder(userId, planType, payChannel || 'wechat');
  ok(res, result);
});

export const payCallback = catchAsync(async (req, res) => {
  const { orderNo, payChannel } = req.body as { orderNo?: string; payChannel?: string };
  if (!orderNo) { error(res, 400, 'Missing orderNo', 400); return; }
  await memberService.markPaid(orderNo, payChannel);
  ok(res, null);
});
