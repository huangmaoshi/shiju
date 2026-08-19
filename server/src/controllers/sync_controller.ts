import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as syncService from '@/services/sync_service';

function getUserId(req: AuthRequest): string | null {
  return req.userId || null;
}

export const pull = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { lastSyncAt } = req.body as { lastSyncAt?: string };
  const result = await syncService.pull(userId, lastSyncAt);
  ok(res, result);
});

export const push = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { records } = req.body as { records?: Array<{ tableName: string; recordId: number; action: string; data: unknown }> };
  if (!records) { error(res, 400, 'Missing records', 400); return; }
  const result = await syncService.push(userId, records);
  ok(res, result);
});

export const batchPush = catchAsync(async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  if (!userId) { error(res, 401, 'Unauthorized', 401); return; }
  const { devices } = req.body as { devices?: Array<{ deviceId: string; records: unknown[] }> };
  if (!devices) { error(res, 400, 'Missing devices', 400); return; }
  const result = await syncService.batchPush(userId, devices);
  ok(res, result);
});
