import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import * as dailyRecommendService from '@/services/daily_recommend_service';

export const getToday = catchAsync(async (_req, res) => {
  const result = await dailyRecommendService.getToday();
  ok(res, result);
});

export const getByDate = catchAsync(async (req, res) => {
  const { date } = req.params;
  const result = await dailyRecommendService.getByDate(date);
  ok(res, result);
});
