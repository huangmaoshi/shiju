import { catchAsync } from '@/utils/async_handler';
import { ok, error as errRes } from '@/utils/response';
import * as aiService from '@/services/ai_service';

export const configList = catchAsync(async (_req, res) => {
  const list = await aiService.listConfigs();
  ok(res, list);
});

export const configGet = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const config = await aiService.getConfig(id);
  ok(res, config);
});

export const configCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.provider || !body.baseUrl || !body.model) {
    return errRes(res, 400, '缺少必要字段（name / provider / baseUrl / model）');
  }
  // local 类型的本地/自建模型可以不需要 API Key
  if (body.provider !== 'local' && !body.apiKey) {
    return errRes(res, 400, '缺少必要字段（apiKey）');
  }
  const config = await aiService.createConfig(body);
  ok(res, config);
});

export const configUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const config = await aiService.updateConfig(id, body);
  ok(res, config);
});

export const configDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await aiService.deleteConfig(id);
  ok(res, null);
});

export const configSetDefault = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const config = await aiService.setDefaultConfig(id);
  ok(res, config);
});

export const taskList = catchAsync(async (_req, res) => {
  const list = await aiService.listTasks();
  ok(res, list);
});

export const taskGet = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const task = await aiService.getTask(id);
  ok(res, task);
});

export const taskDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await aiService.deleteTask(id);
  ok(res, null);
});

export const extractSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = Number(body.configId);
  const originalTextId = Number(body.originalTextId);
  if (!configId || !originalTextId) {
    return errRes(res, 400, '缺少必要字段（configId / originalTextId）');
  }
  const task = await aiService.extractFromText(configId, originalTextId);
  ok(res, task);
});

export const extractBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = Number(body.configId);
  const ids: number[] = body.originalTextIds || [];
  if (!configId) {
    return errRes(res, 400, '缺少必要字段（configId）');
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return errRes(res, 400, 'originalTextIds 必须为非空数组');
  }
  const task = await aiService.extractFromBatch(configId, ids.map(Number));
  ok(res, task);
});

// ====== 拼音生成 ======

export const pinyinQuoteSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const quoteId = Number(body.quoteId);
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!quoteId) return errRes(res, 400, '缺少必要字段（quoteId）');
  const result = await aiService.generatePinyinForQuote(quoteId, configId);
  ok(res, result);
});

export const pinyinQuoteBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  const ids: number[] = body.quoteIds || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return errRes(res, 400, 'quoteIds 必须为非空数组');
  }
  const result = await aiService.generatePinyinForQuotesBatch(ids.map(Number), configId);
  ok(res, result);
});

export const pinyinOriginalTextSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const originalTextId = Number(body.originalTextId);
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!originalTextId) return errRes(res, 400, '缺少必要字段（originalTextId）');
  const result = await aiService.generatePinyinForOriginalText(originalTextId, configId);
  ok(res, result);
});

export const pinyinOriginalTextBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  const ids: number[] = body.originalTextIds || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return errRes(res, 400, 'originalTextIds 必须为非空数组');
  }
  const result = await aiService.generatePinyinForOriginalTextsBatch(ids.map(Number), configId);
  ok(res, result);
});

// ====== 繁转简 ======

export const simplifyText = catchAsync(async (req, res) => {
  const body = req.body || {};
  const text = body.text;
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!text) return errRes(res, 400, '缺少必要字段（text）');
  const result = await aiService.simplifyText(text, configId);
  ok(res, { simplifiedText: result });
});

export const simplifyQuoteSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const quoteId = Number(body.quoteId);
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!quoteId) return errRes(res, 400, '缺少必要字段（quoteId）');
  const result = await aiService.simplifyQuote(quoteId, configId);
  ok(res, result);
});

export const simplifyQuotesBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  const ids: number[] = body.quoteIds || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return errRes(res, 400, 'quoteIds 必须为非空数组');
  }
  const result = await aiService.simplifyQuotesBatch(ids.map(Number), configId);
  ok(res, result);
});

export const simplifyOriginalTextSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const originalTextId = Number(body.originalTextId);
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!originalTextId) return errRes(res, 400, '缺少必要字段（originalTextId）');
  const result = await aiService.simplifyOriginalText(originalTextId, configId);
  ok(res, result);
});

export const simplifyOriginalTextsBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  const ids: number[] = body.originalTextIds || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return errRes(res, 400, 'originalTextIds 必须为非空数组');
  }
  const result = await aiService.simplifyOriginalTextsBatch(ids.map(Number), configId);
  ok(res, result);
});

// ====== 一键批量处理 (One-Click) ======

export const oneClickStats = catchAsync(async (_req, res) => {
  const stats = await aiService.getOneClickStats();
  ok(res, stats);
});

export const oneClickPinyin = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  const limit = body.limit ? Number(body.limit) : undefined;
  const result = await aiService.oneClickPinyinAll(configId, { limit });
  ok(res, result);
});

export const oneClickExtract = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!configId) return errRes(res, 400, '缺少必要字段（configId）');
  const limit = body.limit ? Number(body.limit) : undefined;
  const result = await aiService.oneClickExtractAll(configId, { limit });
  ok(res, result);
});

export const oneClickSimplifyLocal = catchAsync(async (req, res) => {
  const body = req.body || {};
  const limit = body.limit ? Number(body.limit) : undefined;
  const result = await aiService.oneClickSimplifyAllLocal({ limit });
  ok(res, result);
});

// ====== AI 自动分类 ======
export const classifyQuoteSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const quoteId = Number(body.quoteId);
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!quoteId) return errRes(res, 400, '缺少必要字段（quoteId）');
  const result = await aiService.classifyQuote(quoteId, configId);
  ok(res, result);
});

export const classifyQuoteBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const quoteIds: number[] = body.quoteIds || [];
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
    return errRes(res, 400, 'quoteIds 必须为非空数组');
  }
  const result = await aiService.classifyQuotesBatch(quoteIds.map(Number), configId);
  ok(res, result);
});

export const classifyOriginalTextSingle = catchAsync(async (req, res) => {
  const body = req.body || {};
  const originalTextId = Number(body.originalTextId);
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!originalTextId) return errRes(res, 400, '缺少必要字段（originalTextId）');
  const result = await aiService.classifyOriginalText(originalTextId, configId);
  ok(res, result);
});

export const classifyOriginalTextBatch = catchAsync(async (req, res) => {
  const body = req.body || {};
  const originalTextIds: number[] = body.originalTextIds || [];
  const configId = body.configId ? Number(body.configId) : undefined;
  if (!Array.isArray(originalTextIds) || originalTextIds.length === 0) {
    return errRes(res, 400, 'originalTextIds 必须为非空数组');
  }
  const result = await aiService.classifyOriginalTextsBatch(originalTextIds.map(Number), configId);
  ok(res, result);
});

export const oneClickClassify = catchAsync(async (req, res) => {
  const body = req.body || {};
  const configId = body.configId ? Number(body.configId) : undefined;
  const limit = body.limit ? Number(body.limit) : undefined;
  const result = await aiService.oneClickClassifyAll(configId, { limit });
  ok(res, result);
});

export const oneClickClassifyStats = catchAsync(async (_req, res) => {
  const stats = await aiService.getOneClickClassifyStats();
  ok(res, stats);
});
