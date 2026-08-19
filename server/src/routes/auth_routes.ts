import { Router } from 'express';
import * as authController from '@/controllers/auth_controller';
import { authRequired } from '@/middlewares/auth_middleware';
import { loginLimiter } from '@/middlewares/rate_limit_middleware';

const router = Router();

router.post('/wechat-login', loginLimiter, authController.wechatLogin);
router.post('/register', loginLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authRequired, authController.logout);
router.post('/refresh', authController.refresh);

export default router;
