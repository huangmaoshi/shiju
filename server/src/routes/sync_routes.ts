import { Router } from 'express';
import * as syncController from '@/controllers/sync_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.use(authRequired);

router.post('/pull', syncController.pull);
router.post('/push', syncController.push);
router.post('/batch-push', syncController.batchPush);

export default router;
