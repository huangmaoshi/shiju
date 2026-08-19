import { Router } from 'express';
import * as statsController from '@/controllers/stats_controller';
import { authRequired } from '@/middlewares/auth_middleware';
import { adminRequired } from '@/middlewares/admin_middleware';

const router = Router();

// 公开接口：首页统计数据（无需登录）
router.get('/home', statsController.homeStats);

// 管理员接口：Dashboard 统计
router.get('/dashboard', authRequired, adminRequired, statsController.dashboard);

export default router;
