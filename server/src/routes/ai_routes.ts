import { Router } from 'express';
import * as aiController from '@/controllers/ai_controller';
import { adminRequired } from '@/middlewares/admin_middleware';

const router = Router();

router.use(adminRequired);

router.get('/configs', aiController.configList);
router.post('/configs', aiController.configCreate);
router.get('/configs/:id', aiController.configGet);
router.put('/configs/:id', aiController.configUpdate);
router.delete('/configs/:id', aiController.configDelete);
router.post('/configs/:id/default', aiController.configSetDefault);

router.get('/tasks', aiController.taskList);
router.get('/tasks/:id', aiController.taskGet);
router.delete('/tasks/:id', aiController.taskDelete);

router.post('/extract/single', aiController.extractSingle);
router.post('/extract/batch', aiController.extractBatch);

// 拼音生成
router.post('/pinyin/quote/single', aiController.pinyinQuoteSingle);
router.post('/pinyin/quote/batch', aiController.pinyinQuoteBatch);
router.post('/pinyin/original-text/single', aiController.pinyinOriginalTextSingle);
router.post('/pinyin/original-text/batch', aiController.pinyinOriginalTextBatch);

// 繁转简
router.post('/simplify/text', aiController.simplifyText);
router.post('/simplify/quote/single', aiController.simplifyQuoteSingle);
router.post('/simplify/quote/batch', aiController.simplifyQuotesBatch);
router.post('/simplify/original-text/single', aiController.simplifyOriginalTextSingle);
router.post('/simplify/original-text/batch', aiController.simplifyOriginalTextsBatch);

// 一键批量处理
router.get('/one-click/stats', aiController.oneClickStats);
router.post('/one-click/pinyin', aiController.oneClickPinyin);
router.post('/one-click/extract', aiController.oneClickExtract);
router.post('/one-click/simplify-local', aiController.oneClickSimplifyLocal);

// AI 自动分类
router.post('/classify/quote/single', aiController.classifyQuoteSingle);
router.post('/classify/quote/batch', aiController.classifyQuoteBatch);
router.post('/classify/original-text/single', aiController.classifyOriginalTextSingle);
router.post('/classify/original-text/batch', aiController.classifyOriginalTextBatch);
router.get('/one-click/classify-stats', aiController.oneClickClassifyStats);
router.post('/one-click/classify', aiController.oneClickClassify);

export default router;
