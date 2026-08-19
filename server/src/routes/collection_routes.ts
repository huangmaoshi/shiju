import { Router } from 'express';
import * as collectionController from '@/controllers/collection_controller';
import { authRequired } from '@/middlewares/auth_middleware';

const router = Router();

router.use(authRequired);

router.get('/', collectionController.list);
router.post('/', collectionController.create);

router.get('/stats', collectionController.stats);
router.get('/quotes/:quoteId/collect', collectionController.collectQuote);
router.delete('/quotes/:quoteId/collect', collectionController.uncollectQuote);

router.put('/:id', collectionController.rename);
router.delete('/:id', collectionController.remove);
router.get('/:id/quotes', collectionController.getQuotes);
router.post('/:id/quotes', collectionController.addQuote);
router.delete('/:id/quotes/:recordId', collectionController.removeQuote);

export default router;
