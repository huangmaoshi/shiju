import { Router } from 'express';
import * as dailyRecommendController from '@/controllers/daily_recommend_controller';

const router = Router();

router.get('/today', dailyRecommendController.getToday);
router.get('/history', dailyRecommendController.getToday);
router.get('/:date', dailyRecommendController.getByDate);

export default router;
