import { Router } from 'express';
import * as searchController from '@/controllers/search_controller';
import { authOptional, authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.get('/quotes', authOptional, searchController.searchQuotes);
router.get('/original-texts', searchController.searchOriginalText);
router.get('/hot', searchController.getHot);
router.post('/history', authRequired, searchController.saveHistory);
router.delete('/history', authRequired, searchController.clearHistory);

export default router;
