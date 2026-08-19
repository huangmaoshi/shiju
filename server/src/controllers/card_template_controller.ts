import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import * as cardTemplateService from '@/services/card_template_service';

export const list = catchAsync(async (_req, res) => {
  const result = await cardTemplateService.list();
  ok(res, result);
});

export const getById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await cardTemplateService.getById(id);
  ok(res, result);
});
