import { catchAsync } from '@/utils/async_handler';
import { ok, error } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as authService from '@/services/auth_service';

export const wechatLogin = catchAsync(async (req, res) => {
  const code = (req.body as { code?: string })?.code;
  const result = await authService.wechatLogin(code);
  ok(res, result);
});

export const register = catchAsync(async (req, res) => {
  const { username, password, nickname } = req.body as { username?: string; password?: string; nickname?: string };
  if (!username || !password) {
    error(res, 400, '账号和密码不能为空', 400);
    return;
  }
  const result = await authService.register(username, password, nickname);
  ok(res, result);
});

export const login = catchAsync(async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    error(res, 400, '账号和密码不能为空', 400);
    return;
  }
  const result = await authService.login(username, password);
  ok(res, result);
});

export const logout = catchAsync(async (req, res) => {
  const userId = (req as AuthRequest).userId;
  if (userId) await authService.logout(userId);
  ok(res, null);
});

export const refresh = catchAsync(async (req, res) => {
  const token = (req.body as { token?: string })?.token;
  if (!token) {
    error(res, 400, 'Missing token', 400);
    return;
  }
  const result = await authService.refresh(token);
  ok(res, result);
});
