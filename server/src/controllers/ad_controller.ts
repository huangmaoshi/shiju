import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as adService from '@/services/ad_service';

function getUserId(req: AuthRequest): string | null {
  return req.userId || null;
}

export const getConfigs = catchAsync(async (req, res) => {
  const { position, platform } = req.query as { position?: string; platform?: string };
  if (!position) { error(res, 400, 'Missing position', 400); return; }
  const result = await adService.getConfigs(position, platform);
  ok(res, result);
});

export const impression = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  const { adUnitId } = req.body as { adUnitId?: string };
  if (!adUnitId) { error(res, 400, 'Missing adUnitId', 400); return; }
  await adService.impression(userId || 'anonymous', adUnitId);
  ok(res, null);
});

export const click = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  const { adUnitId } = req.body as { adUnitId?: string };
  if (!adUnitId) { error(res, 400, 'Missing adUnitId', 400); return; }
  await adService.click(userId || 'anonymous', adUnitId);
  ok(res, null);
});

export const rewardVerify = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { adUnitId, rewardToken } = req.body as { adUnitId?: string; rewardToken?: string };
  if (!adUnitId || !rewardToken) { error(res, 400, 'Missing adUnitId or rewardToken', 400); return; }
  const result = await adService.rewardVerify(userId, adUnitId, rewardToken);
  ok(res, result);
});
