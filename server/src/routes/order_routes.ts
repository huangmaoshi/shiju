import { Router } from 'express';
import * as orderController from '@/controllers/order_controller';

const router = Router();

router.post('/pay/callback', orderController.payCallback);

export default router;
