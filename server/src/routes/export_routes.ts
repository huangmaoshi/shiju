import { Router } from 'express';
import * as exportController from '@/controllers/export_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.use(authRequired);

router.post('/collection', exportController.exportCollection);
router.post('/custom', exportController.exportCustom);

export default router;
