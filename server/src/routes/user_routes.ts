import { Router } from 'express';
import * as userController from '@/controllers/user_controller';
import { authRequired, authOptional } from '@/middlewares/auth_middleware';

const router = Router();

// 获取当前登录用户信息（未登录时返回 null）
router.get('/me', authOptional, userController.getMe);

export default router;
