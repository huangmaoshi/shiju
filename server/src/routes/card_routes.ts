import { Router } from 'express';
import * as cardController from '@/controllers/card_template_controller';

const router = Router();

router.get('/', cardController.list);
router.get('/:id', cardController.getById);

export default router;
