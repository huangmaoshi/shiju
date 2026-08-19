import { Router } from 'express';
import * as memberController from '@/controllers/member_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.get('/info', authRequired, memberController.getInfo);
router.get('/plans', memberController.getPlans);
router.post('/order', authRequired, memberController.createOrder);
router.post('/pay/callback', memberController.payCallback);

export default router;
