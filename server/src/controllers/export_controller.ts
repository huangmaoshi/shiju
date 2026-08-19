import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as exportService from '@/services/export_service';

function getUserId(req: AuthRequest): string | null {
  return req.userId || null;
}

export const exportCollection = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { collectionId, format } = req.body as { collectionId?: number; format?: string };
  if (!collectionId) { error(res, 400, 'Missing collectionId', 400); return; }
  const result = await exportService.exportCollection(userId, collectionId, format || 'txt');
  res.setHeader('Content-Type', result.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.status(200).send(result.buffer);
});

export const exportCustom = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { format } = req.body as { format?: string };
  const result = await exportService.exportCustom(userId, format || 'txt');
  res.setHeader('Content-Type', result.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.status(200).send(result.buffer);
});
