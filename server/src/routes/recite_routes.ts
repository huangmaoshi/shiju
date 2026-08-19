import { Router } from 'express';
import * as reciteController from '@/controllers/recite_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.use(authRequired);

router.get('/', reciteController.list);
router.post('/', reciteController.add);
router.delete('/:id', reciteController.remove);
router.get('/today', reciteController.today);
router.post('/review', reciteController.review);
router.get('/calendar', reciteController.calendar);
router.get('/stats', reciteController.stats);

export default router;
