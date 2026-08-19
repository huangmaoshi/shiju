import { Router } from 'express';
import * as categoryController from '@/controllers/category_controller';
import { adminRequired } from '@/middlewares/admin_middleware';

const router = Router();

router.get('/', categoryController.list);
router.post('/', adminRequired, categoryController.create);
router.put('/:id', adminRequired, categoryController.update);
router.delete('/:id', adminRequired, categoryController.remove);

export default router;
