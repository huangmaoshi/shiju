import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import * as orderService from '@/services/order_service';

export const payCallback = catchAsync(async (req, res) => {
  const { orderNo } = req.body as { orderNo?: string };
  if (!orderNo) { error(res, 400, 'Missing orderNo', 400); return; }
  await orderService.markPaid(orderNo);
  ok(res, null);
});
