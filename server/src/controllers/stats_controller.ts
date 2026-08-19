import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import * as statsService from '@/services/stats_service';

export const dashboard = catchAsync(async (_req, res) => {
  const result = await statsService.dashboard();
  ok(res, result);
});

export const homeStats = catchAsync(async (_req, res) => {
  const result = await statsService.homeStats();
  ok(res, result);
});
