import { Router } from 'express';
import * as customQuoteController from '@/controllers/custom_quote_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.use(authRequired);

router.get('/', customQuoteController.list);
router.post('/', customQuoteController.create);
router.put('/:id', customQuoteController.update);
router.delete('/:id', customQuoteController.remove);
router.get('/quota', customQuoteController.getQuota);

export default router;
