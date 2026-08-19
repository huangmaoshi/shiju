import { Router } from 'express';
import * as compositionController from '@/controllers/composition_controller';

const router = Router();

router.get('/', compositionController.list);
router.get('/:id', compositionController.getById);

export default router;
