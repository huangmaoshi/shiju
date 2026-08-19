import { Router } from 'express';
import * as statsController from '@/controllers/stats_controller';
import { authRequired } from '@/middlewares/auth_middleware';
import { adminRequired } from '@/middlewares/admin_middleware';

const router = Router();

router.get('/dashboard', authRequired, adminRequired, statsController.dashboard);

export default router;
