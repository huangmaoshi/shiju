import { Router } from 'express';
import * as quoteController from '@/controllers/quote_controller';
import { authOptional } from '@/middlewares/auth_middleware';
import { adminRequired } from '@/middlewares/admin_middleware';

const router = Router();

router.get('/', authOptional, quoteController.list);
router.get('/random', authOptional, quoteController.random);
router.get('/:id', authOptional, quoteController.getById);

router.post('/', adminRequired, quoteController.create);
router.put('/:id', adminRequired, quoteController.update);
router.delete('/:id', adminRequired, quoteController.remove);
router.put('/:id/status', adminRequired, quoteController.setStatus);

export default router;
