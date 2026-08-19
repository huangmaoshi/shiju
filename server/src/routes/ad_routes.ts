import { Router } from 'express';
import * as adController from '@/controllers/ad_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.get('/configs', adController.getConfigs);
router.post('/impression', authRequired, adController.impression);
router.post('/click', authRequired, adController.click);
router.post('/reward-verify', authRequired, adController.rewardVerify);

export default router;
