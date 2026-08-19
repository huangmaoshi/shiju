import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import * as themePackageService from '@/services/theme_package_service';

export const list = catchAsync(async (_req, res) => {
  const result = await themePackageService.list();
  ok(res, result);
});

export const getById = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const result = await themePackageService.getById(id);
  ok(res, result);
});
