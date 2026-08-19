import { Router } from 'express';
import * as originalTextController from '@/controllers/original_text_controller';
import { authOptional } from '@/middlewares/auth_middleware';
import { adminRequired } from '@/middlewares/admin_middleware';

const router = Router();

router.get('/', authOptional, originalTextController.list);
router.get('/:id', authOptional, originalTextController.getById);

router.post('/', adminRequired, originalTextController.create);
router.put('/:id', adminRequired, originalTextController.update);
router.delete('/:id', adminRequired, originalTextController.remove);

router.post('/:id/add-quote', adminRequired, originalTextController.addQuote);

export default router;
