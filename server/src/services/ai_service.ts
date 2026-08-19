import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';
import { AiClient, AiClientError } from '@/utils/ai_client';
import { containsTraditionalChinese, tradToSimpl } from '@/utils/trad_to_simpl';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

const DEFAULT_PROMPT_TEMPLATE =
  '请从以下{type}中提取 3-8 句最具金句潜质的句子，每句一行，只输出句子不要序号：\n\n{content}';

// ====== AiConfig ======

interface CreateConfigInput {
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplate?: string;
  pinyinPromptTemplate?: string;
  simplifyPromptTemplate?: string;
  classifyPromptTemplate?: string;
  timeoutMs?: number;
  retryCount?: number;
  batchConcurrency?: number;
  remark?: string;
}

interface UpdateConfigInput {
  name?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplate?: string;
  pinyinPromptTemplate?: string;
  simplifyPromptTemplate?: string;
  classifyPromptTemplate?: string;
  timeoutMs?: number;
  retryCount?: number;
  batchConcurrency?: number;
  isActive?: boolean;
  remark?: string;
}

async function listConfigs() {
  return prisma.aiConfig.findMany({
    orderBy: { id: 'desc' },
  });
}

async function getConfig(id: number) {
  const config = await prisma.aiConfig.findUnique({ where: { id } });
  if (!config) throw new BusinessError(404, 'AI 配置不存在', 404);
  return config;
}

async function createConfig(data: CreateConfigInput) {
  const config = await prisma.aiConfig.create({
    data: {
      name: data.name,
      provider: data.provider,
      apiKey: data.apiKey || '',
      baseUrl: data.baseUrl,
      model: data.model,
      temperature: data.temperature ?? 0.7,
      maxTokens: data.maxTokens ?? 2048,
      promptTemplate: data.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE,
      pinyinPromptTemplate: data.pinyinPromptTemplate || null,
      simplifyPromptTemplate: data.simplifyPromptTemplate || null,
      classifyPromptTemplate: data.classifyPromptTemplate || null,
      timeoutMs: data.timeoutMs ?? 60_000,
      retryCount: data.retryCount ?? 2,
      batchConcurrency: data.batchConcurrency ?? 3,
      remark: data.remark ?? null,
    },
  });
  return config;
}

async function updateConfig(id: number, data: UpdateConfigInput) {
  const config = await prisma.aiConfig.findUnique({ where: { id } });
  if (!config) throw new BusinessError(404, 'AI 配置不存在', 404);
  return prisma.aiConfig.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      provider: data.provider ?? undefined,
      apiKey: data.apiKey ?? undefined,
      baseUrl: data.baseUrl ?? undefined,
      model: data.model ?? undefined,
      temperature: data.temperature ?? undefined,
      maxTokens: data.maxTokens ?? undefined,
      promptTemplate: data.promptTemplate ?? undefined,
      pinyinPromptTemplate: data.pinyinPromptTemplate ?? undefined,
      simplifyPromptTemplate: data.simplifyPromptTemplate ?? undefined,
      classifyPromptTemplate: data.classifyPromptTemplate ?? undefined,
      timeoutMs: data.timeoutMs ?? undefined,
      retryCount: data.retryCount ?? undefined,
      batchConcurrency: data.batchConcurrency ?? undefined,
      isActive: data.isActive ?? undefined,
      remark: data.remark ?? undefined,
    },
  });
}

async function deleteConfig(id: number) {
  const config = await prisma.aiConfig.findUnique({ where: { id } });
  if (!config) throw new BusinessError(404, 'AI 配置不存在', 404);
  if (config.isDefault) {
    throw new BusinessError(400, '默认配置不可删除，请先设置其他默认配置');
  }
  await prisma.aiConfig.delete({ where: { id } });
  return null;
}

async function setDefaultConfig(id: number) {
  const config = await prisma.aiConfig.findUnique({ where: { id } });
  if (!config) throw new BusinessError(404, 'AI 配置不存在', 404);
  await prisma.aiConfig.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });
  return prisma.aiConfig.update({
    where: { id },
    data: { isDefault: true, isActive: true },
  });
}

// ====== AiExtractTask ======

async function listTasks() {
  return prisma.aiExtractTask.findMany({
    orderBy: { id: 'desc' },
    take: 200,
  });
}

async function getTask(id: number) {
  const task = await prisma.aiExtractTask.findUnique({ where: { id } });
  if (!task) throw new BusinessError(404, '提取任务不存在', 404);
  return task;
}

async function deleteTask(id: number) {
  const task = await prisma.aiExtractTask.findUnique({ where: { id } });
  if (!task) throw new BusinessError(404, '提取任务不存在', 404);
  await prisma.aiExtractTask.delete({ where: { id } });
  return null;
}

// ====== 提取入口 ======

async function extractFromText(configId: number, originalTextId: number) {
  const config = await prisma.aiConfig.findUnique({ where: { id: configId } });
  if (!config) throw new BusinessError(404, 'AI 配置不存在', 404);

  const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
  if (!original) throw new BusinessError(404, '原文不存在', 404);

  const task = await prisma.aiExtractTask.create({
    data: {
      configId,
      originalTextId,
      batchSource: 'original_text',
      status: 'pending',
      totalCount: 1,
    },
  });

  void _runExtract(task.id);
  return task;
}

async function extractFromBatch(configId: number, originalTextIds: number[]) {
  if (!originalTextIds.length) throw new BusinessError(400, 'ID 列表不能为空');

  const config = await prisma.aiConfig.findUnique({ where: { id: configId } });
  if (!config) throw new BusinessError(404, 'AI 配置不存在', 404);

  const originals = await prisma.originalText.findMany({
    where: { id: { in: originalTextIds } },
    select: { id: true },
  });
  if (!originals.length) throw new BusinessError(404, '没有找到有效的原文');

  const validIds = originals.map((o) => o.id);

  const task = await prisma.aiExtractTask.create({
    data: {
      configId,
      batchSource: 'original_text',
      batchIds: JSON.stringify(validIds),
      status: 'pending',
      totalCount: validIds.length,
    },
  });

  void _runBatchExtract(task.id);
  return task;
}

// ====== 内部执行 ======

function _buildClient(config: {
  apiKey?: string | null;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
  retryCount?: number;
}) {
  return new AiClient({
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs ?? 60_000,
    retryCount: config.retryCount ?? 2,
  });
}

function _buildPrompt(template: string, content: string, type?: string): string {
  const safeType = type || '文章';
  return template.replaceAll('{type}', safeType).replaceAll('{content}', content);
}

function _parseSentences(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const cleaned = lines.map((line) => {
    return line
      .replace(/^[\d①②③④⑤⑥⑦⑧⑨⑩一二三四五六七八九十]+[\.、\)\]\s]+/, '')
      .trim();
  });

  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of cleaned) {
    if (!s) continue;
    const key = s.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }
  return result;
}

async function _runExtract(taskId: number) {
  const startedAt = Date.now();
  try {
    const task = await prisma.aiExtractTask.findUnique({ where: { id: taskId } });
    if (!task || !task.originalTextId) return;

    await prisma.aiExtractTask.update({
      where: { id: taskId },
      data: { status: 'running', startAt: new Date() },
    });

    const [config, original] = await Promise.all([
      prisma.aiConfig.findUnique({ where: { id: task.configId } }),
      prisma.originalText.findUnique({ where: { id: task.originalTextId } }),
    ]);
    if (!config || !original) throw new Error('配置或原文缺失');

    const client = _buildClient(config);
    const prompt = _buildPrompt(
      config.promptTemplate || DEFAULT_PROMPT_TEMPLATE,
      original.content,
      original.categoryType || original.title
    );

    const raw = await client.chat([
      { role: 'system', content: '你是一个专业的金句提取助手。' },
      { role: 'user', content: prompt },
    ]);

    const sentences = _parseSentences(raw);

    let createdCount = 0;
    for (const sentence of sentences) {
      await prisma.quote.create({
        data: {
          content: sentence,
          author: original.author,
          source: original.source ?? original.title,
          sourceUrl: original.sourceUrl,
          originalTextId: original.id,
          provider: 'ai_extract',
          aiExtracted: true,
          quoteType: 'ai',
          isFree: true,
          isActive: true,
          wordCount: sentence.length,
        },
      });
      createdCount++;
    }

    await prisma.originalText.update({
      where: { id: original.id },
      data: { quoteCount: { increment: createdCount } },
    });

    const duration = Date.now() - startedAt;
    await prisma.aiExtractTask.update({
      where: { id: taskId },
      data: {
        status: 'success',
        successCount: createdCount,
        extractedQuotes: JSON.stringify(sentences),
        endAt: new Date(),
        duration,
      },
    });

    logger.info(`[AI Extract] task=${taskId} original=${original.id} quotes=${createdCount} duration=${duration}ms`);
  } catch (err) {
    const duration = Date.now() - startedAt;
    const message = err instanceof AiClientError
      ? `AI 错误 (${err.status}): ${err.message}`
      : (err as Error).message;
    logger.error(`[AI Extract] task=${taskId} failed: ${message}`);
    await prisma.aiExtractTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        errorMessage: message,
        endAt: new Date(),
        duration,
      },
    });
  }
}

async function _runBatchExtract(taskId: number) {
  const startedAt = Date.now();
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  try {
    const task = await prisma.aiExtractTask.findUnique({ where: { id: taskId } });
    if (!task) return;

    await prisma.aiExtractTask.update({
      where: { id: taskId },
      data: { status: 'running', startAt: new Date() },
    });

    const config = await prisma.aiConfig.findUnique({ where: { id: task.configId } });
    if (!config) throw new Error('AI 配置不存在');

    const ids: number[] = task.batchIds ? JSON.parse(task.batchIds) : [];
    const client = _buildClient(config);

    for (const originalId of ids) {
      try {
        const original = await prisma.originalText.findUnique({ where: { id: originalId } });
        if (!original) {
          failCount++;
          errors.push(`原文 ${originalId} 不存在`);
          continue;
        }

        const prompt = _buildPrompt(
          config.promptTemplate || DEFAULT_PROMPT_TEMPLATE,
          original.content,
          original.categoryType || original.title
        );

        const raw = await client.chat([
          { role: 'system', content: '你是一个专业的金句提取助手。' },
          { role: 'user', content: prompt },
        ]);

        const sentences = _parseSentences(raw);
        let createdCount = 0;
        for (const sentence of sentences) {
          await prisma.quote.create({
            data: {
              content: sentence,
              author: original.author,
              source: original.source ?? original.title,
              sourceUrl: original.sourceUrl,
              originalTextId: original.id,
              provider: 'ai_extract',
              aiExtracted: true,
              quoteType: 'ai',
              isFree: true,
              isActive: true,
              wordCount: sentence.length,
            },
          });
          createdCount++;
        }

        await prisma.originalText.update({
          where: { id: original.id },
          data: { quoteCount: { increment: createdCount } },
        });

        successCount += createdCount;
      } catch (itemErr) {
        failCount++;
        const msg = itemErr instanceof AiClientError
          ? `AI 错误 (${itemErr.status}): ${itemErr.message}`
          : (itemErr as Error).message;
        errors.push(`原文 ${originalId}: ${msg}`);
      }
    }

    const duration = Date.now() - startedAt;
    await prisma.aiExtractTask.update({
      where: { id: taskId },
      data: {
        status: failCount === ids.length ? 'failed' : 'success',
        successCount,
        failCount,
        errorMessage: errors.slice(0, 10).join('; '),
        endAt: new Date(),
        duration,
      },
    });

    logger.info(
      `[AI Batch] task=${taskId} total=${ids.length} success=${successCount} fail=${failCount} duration=${duration}ms`
    );
  } catch (err) {
    const duration = Date.now() - startedAt;
    logger.error(`[AI Batch] task=${taskId} fatal: ${(err as Error).message}`);
    await prisma.aiExtractTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        failCount,
        successCount,
        errorMessage: (err as Error).message,
        endAt: new Date(),
        duration,
      },
    });
  }
}

// ====== 拼音生成 ======

const PINYIN_PROMPT = `请为以下中文文本逐字标注拼音。返回JSON数组格式，每个元素为 {"c":"单个字符","p":"带声调的拼音"}。
要求：
1. 每个中文字符对应一个拼音（带声调标记，如 hǎi）
2. 标点符号的 p 为空字符串 ""
3. 换行符的 c 为 "\\n"，p 为空字符串
4. 只返回JSON数组，不要任何其他内容、不要markdown代码块

文本：{content}`;

/** 解析 AI 返回的拼音 JSON，容错处理 */
function _parsePinyinJson(raw: string, text: string): string | null {
  try {
    // 尝试去掉 markdown 代码块包裹
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const arr = JSON.parse(cleaned) as Array<{ c: string; p: string }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    // 验证格式：每个元素必须有 c 和 p 字段
    const valid = arr.every((item) => typeof item.c === 'string' && typeof item.p === 'string');
    if (!valid) return null;
    return JSON.stringify(arr);
  } catch {
    logger.error(`[AI Pinyin] 解析失败，原始返回: ${raw.slice(0, 200)}`);
    return null;
  }
}

/** 生成单条金句拼音 */
async function generatePinyinForQuote(quoteId: number, configId?: number) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new BusinessError(404, '金句不存在', 404);

  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.pinyinPromptTemplate || PINYIN_PROMPT;
  const prompt = template.replace('{content}', quote.content);

  const raw = await client.chat([
    { role: 'system', content: '你是一个专业的中文拼音标注助手。' },
    { role: 'user', content: prompt },
  ]);

  const pinyinData = _parsePinyinJson(raw, quote.content);
  if (!pinyinData) throw new BusinessError(500, 'AI 返回拼音格式解析失败', 500);

  await prisma.quote.update({
    where: { id: quoteId },
    data: { pinyinData },
  });

  logger.info(`[AI Pinyin] quote=${quoteId} chars=${quote.content.length} done`);
  return { id: quoteId, pinyinData };
}

/** 批量生成金句拼音 */
async function generatePinyinForQuotesBatch(quoteIds: number[], configId?: number) {
  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.pinyinPromptTemplate || PINYIN_PROMPT;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const quoteId of quoteIds) {
    try {
      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) { failed++; errors.push(`金句 ${quoteId} 不存在`); continue; }

      const prompt = template.replace('{content}', quote.content);
      const raw = await client.chat([
        { role: 'system', content: '你是一个专业的中文拼音标注助手。' },
        { role: 'user', content: prompt },
      ]);

      const pinyinData = _parsePinyinJson(raw, quote.content);
      if (!pinyinData) { failed++; errors.push(`金句 ${quoteId} 拼音解析失败`); continue; }

      await prisma.quote.update({ where: { id: quoteId }, data: { pinyinData } });
      success++;
    } catch (err) {
      failed++;
      errors.push(`金句 ${quoteId}: ${(err as Error).message}`);
    }
  }

  logger.info(`[AI Pinyin Batch] quotes total=${quoteIds.length} success=${success} failed=${failed}`);
  return { total: quoteIds.length, success, failed, errors: errors.slice(0, 10) };
}

/** 生成单条原文拼音 */
async function generatePinyinForOriginalText(originalTextId: number, configId?: number) {
  const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
  if (!original) throw new BusinessError(404, '原文不存在', 404);

  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.pinyinPromptTemplate || PINYIN_PROMPT;
  const prompt = template.replace('{content}', original.content);

  const raw = await client.chat([
    { role: 'system', content: '你是一个专业的中文拼音标注助手。' },
    { role: 'user', content: prompt },
  ]);

  const pinyinData = _parsePinyinJson(raw, original.content);
  if (!pinyinData) throw new BusinessError(500, 'AI 返回拼音格式解析失败', 500);

  await prisma.originalText.update({
    where: { id: originalTextId },
    data: { pinyinData },
  });

  logger.info(`[AI Pinyin] originalText=${originalTextId} chars=${original.content.length} done`);
  return { id: originalTextId, pinyinData };
}

/** 批量生成原文拼音 */
async function generatePinyinForOriginalTextsBatch(originalTextIds: number[], configId?: number) {
  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.pinyinPromptTemplate || PINYIN_PROMPT;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const originalTextId of originalTextIds) {
    try {
      const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
      if (!original) { failed++; errors.push(`原文 ${originalTextId} 不存在`); continue; }

      const prompt = template.replace('{content}', original.content);
      const raw = await client.chat([
        { role: 'system', content: '你是一个专业的中文拼音标注助手。' },
        { role: 'user', content: prompt },
      ]);

      const pinyinData = _parsePinyinJson(raw, original.content);
      if (!pinyinData) { failed++; errors.push(`原文 ${originalTextId} 拼音解析失败`); continue; }

      await prisma.originalText.update({ where: { id: originalTextId }, data: { pinyinData } });
      success++;
    } catch (err) {
      failed++;
      errors.push(`原文 ${originalTextId}: ${(err as Error).message}`);
    }
  }

  logger.info(`[AI Pinyin Batch] originalTexts total=${originalTextIds.length} success=${success} failed=${failed}`);
  return { total: originalTextIds.length, success, failed, errors: errors.slice(0, 10) };
}

// ====== 串行批处理工具 ======

async function processBatchSerially<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    try {
      await processor(items[i], i);
    } catch (err) {
      logger.error(`[Batch] item ${i} failed: ${(err as Error).message}`);
    }
    if (onProgress) onProgress(i + 1, items.length);
  }
}

// ====== 繁转简 ======

const DEFAULT_SIMPLIFY_PROMPT = `请将以下繁体字/异体字文本转换为标准简体中文。

要求：
1. 保持原文的标点、格式和段落结构不变
2. 只做繁简转换，不要修改任何词汇或语法
3. 如果文本已是简体，直接返回原文
4. 只返回转换后的文本，不要任何解释

文本：
{content}`;

async function simplifyText(
  text: string,
  configId?: number
): Promise<string> {
  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.simplifyPromptTemplate || DEFAULT_SIMPLIFY_PROMPT;
  const prompt = template.replace('{content}', text);

  const raw = await client.chat([
    { role: 'system', content: '你是一个专业的繁简转换助手，擅长将繁体字转换为标准简体中文。' },
    { role: 'user', content: prompt },
  ]);

  const result = raw.trim();
  logger.info(`[AI Simplify] input=${text.length} chars output=${result.length} chars`);
  return result;
}

async function simplifyQuote(quoteId: number, configId?: number) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new BusinessError(404, '金句不存在', 404);

  const simplified = await simplifyText(quote.content, configId);
  await prisma.quote.update({
    where: { id: quoteId },
    data: { simplifiedContent: simplified },
  });

  logger.info(`[AI Simplify] quote=${quoteId} done`);
  return { id: quoteId, content: quote.content, simplifiedContent: simplified };
}

async function simplifyQuotesBatch(quoteIds: number[], configId?: number) {
  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.simplifyPromptTemplate || DEFAULT_SIMPLIFY_PROMPT;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const quoteId of quoteIds) {
    try {
      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) { failed++; errors.push(`金句 ${quoteId} 不存在`); continue; }

      const prompt = template.replace('{content}', quote.content);
      const raw = await client.chat([
        { role: 'system', content: '你是一个专业的繁简转换助手。' },
        { role: 'user', content: prompt },
      ]);

      await prisma.quote.update({
        where: { id: quoteId },
        data: { simplifiedContent: raw.trim() },
      });
      success++;
      logger.info(`[AI Simplify] progress ${success + failed}/${quoteIds.length}`);
    } catch (err) {
      failed++;
      errors.push(`金句 ${quoteId}: ${(err as Error).message}`);
    }
  }

  logger.info(`[AI Simplify Batch] total=${quoteIds.length} success=${success} failed=${failed}`);
  return { total: quoteIds.length, success, failed, errors: errors.slice(0, 10) };
}

async function simplifyOriginalText(originalTextId: number, configId?: number) {
  const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
  if (!original) throw new BusinessError(404, '原文不存在', 404);

  const simplified = await simplifyText(original.content, configId);
  await prisma.originalText.update({
    where: { id: originalTextId },
    data: { simplifiedContent: simplified },
  });

  logger.info(`[AI Simplify] originalText=${originalTextId} done`);
  return { id: originalTextId, content: original.content, simplifiedContent: simplified };
}

async function simplifyOriginalTextsBatch(originalTextIds: number[], configId?: number) {
  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);

  const client = _buildClient(config);
  const template = config.simplifyPromptTemplate || DEFAULT_SIMPLIFY_PROMPT;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const originalTextId of originalTextIds) {
    try {
      const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
      if (!original) { failed++; errors.push(`原文 ${originalTextId} 不存在`); continue; }

      const prompt = template.replace('{content}', original.content);
      const raw = await client.chat([
        { role: 'system', content: '你是一个专业的繁简转换助手。' },
        { role: 'user', content: prompt },
      ]);

      await prisma.originalText.update({
        where: { id: originalTextId },
        data: { simplifiedContent: raw.trim() },
      });
      success++;
      logger.info(`[AI Simplify] progress ${success + failed}/${originalTextIds.length}`);
    } catch (err) {
      failed++;
      errors.push(`原文 ${originalTextId}: ${(err as Error).message}`);
    }
  }

  logger.info(`[AI Simplify Batch] originalTexts total=${originalTextIds.length} success=${success} failed=${failed}`);
  return { total: originalTextIds.length, success, failed, errors: errors.slice(0, 10) };
}

// ====== 一键批量处理（One-Click Batch）======

interface OneClickStats {
  quotesWithoutPinyin: number;
  originalTextsWithoutPinyin: number;
  originalTextsWithoutQuotes: number;
  quotesWithTraditional: number;
  originalTextsWithTraditional: number;
}

async function getOneClickStats(): Promise<OneClickStats> {
  const [
    quotesWithoutPinyin,
    originalTextsWithoutPinyin,
    originalTextsWithoutQuotes,
  ] = await Promise.all([
    prisma.quote.count({ where: { OR: [{ pinyinData: null }, { pinyinData: '' }] } }),
    prisma.originalText.count({ where: { OR: [{ pinyinData: null }, { pinyinData: '' }] } }),
    prisma.originalText.count({ where: { quoteCount: 0, status: 1 } }),
  ]);

  // 繁体字识别需要内存扫描，limit 一次避免爆内存；分批读取
  let quotesWithTraditional = 0;
  let cursorQuote: number | undefined;
  while (true) {
    const batch = await prisma.quote.findMany({
      take: 1000,
      select: { id: true, content: true },
      cursor: cursorQuote ? { id: cursorQuote } : undefined,
      skip: cursorQuote ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    if (batch.length === 0) break;
    for (const q of batch) {
      if (containsTraditionalChinese(q.content)) quotesWithTraditional++;
    }
    cursorQuote = batch[batch.length - 1].id;
    if (batch.length < 1000) break;
  }

  let originalTextsWithTraditional = 0;
  let cursorOt: number | undefined;
  while (true) {
    const batch = await prisma.originalText.findMany({
      take: 200,
      select: { id: true, content: true },
      cursor: cursorOt ? { id: cursorOt } : undefined,
      skip: cursorOt ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    if (batch.length === 0) break;
    for (const t of batch) {
      if (containsTraditionalChinese(t.content)) originalTextsWithTraditional++;
    }
    cursorOt = batch[batch.length - 1].id;
    if (batch.length < 200) break;
  }

  return {
    quotesWithoutPinyin,
    originalTextsWithoutPinyin,
    originalTextsWithoutQuotes,
    quotesWithTraditional,
    originalTextsWithTraditional,
  };
}

/**
 * 一键拼音：给所有没有 pinyinData 的金句 / 原文 批量加上拼音（串行）
 */
async function oneClickPinyinAll(configId?: number, opts?: { limit?: number }) {
  const limit = opts?.limit;
  const limitClause = limit ? { take: limit } : {};

  const quoteIds = (
    await prisma.quote.findMany({
      where: { OR: [{ pinyinData: null }, { pinyinData: '' }] },
      select: { id: true },
      orderBy: { id: 'asc' },
      ...(limitClause as any),
    })
  ).map((q: any) => q.id);

  const originalTextIds = (
    await prisma.originalText.findMany({
      where: { OR: [{ pinyinData: null }, { pinyinData: '' }] },
      select: { id: true },
      orderBy: { id: 'asc' },
      ...(limitClause as any),
    })
  ).map((t: any) => t.id);

  const quoteResult = quoteIds.length
    ? await generatePinyinForQuotesBatch(quoteIds, configId)
    : { total: 0, success: 0, failed: 0, errors: [] };

  const originalResult = originalTextIds.length
    ? await generatePinyinForOriginalTextsBatch(originalTextIds, configId)
    : { total: 0, success: 0, failed: 0, errors: [] };

  return {
    quotes: quoteResult,
    originalTexts: originalResult,
  };
}

/**
 * 一键提取：给所有 quoteCount = 0 的原文批量提取金句
 * 使用后台任务队列（复用 extractFromBatch）
 */
async function oneClickExtractAll(configId: number, opts?: { limit?: number }) {
  const limit = opts?.limit;
  const where = { quoteCount: 0, status: 1 } as any;
  const findOpts = limit
    ? { where, select: { id: true }, take: limit, orderBy: { id: 'asc' } }
    : { where, select: { id: true }, orderBy: { id: 'asc' } };

  const originalTextIds = (await prisma.originalText.findMany(findOpts as any)).map((t: any) => t.id);
  if (originalTextIds.length === 0) {
    return { total: 0, success: 0, failed: 0, taskId: null, skipped: true };
  }

  // extractFromBatch 会创建异步任务并返回，串行处理在 _runBatchExtract 中执行
  const task = await extractFromBatch(configId, originalTextIds);
  return {
    total: originalTextIds.length,
    taskId: task.id,
    enqueued: true,
  };
}

/**
 * 一键繁转简（本地纯JS映射，不需要AI，极快）
 * 仅处理 content 中含有繁体字的条目
 */
async function oneClickSimplifyAllLocal(opts?: { limit?: number }) {
  const limit = opts?.limit;
  let quoteSuccess = 0;
  let quoteFailed = 0;
  const quoteErrors: string[] = [];

  // 扫描金句
  let quoteCursor: number | undefined;
  let quoteScanned = 0;
  while (true) {
    if (limit && quoteScanned >= limit) break;
    const batch = await prisma.quote.findMany({
      take: 500,
      select: { id: true, content: true },
      cursor: quoteCursor ? { id: quoteCursor } : undefined,
      skip: quoteCursor ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    if (batch.length === 0) break;

    for (const q of batch) {
      if (limit && quoteScanned >= limit) break;
      quoteScanned++;
      if (!containsTraditionalChinese(q.content)) continue;
      try {
        const simplified = tradToSimpl(q.content);
        if (simplified !== q.content) {
          await prisma.quote.update({
            where: { id: q.id },
            data: { simplifiedContent: simplified },
          });
        }
        quoteSuccess++;
      } catch (e: any) {
        quoteFailed++;
        if (quoteErrors.length < 10) quoteErrors.push(`金句 ${q.id}: ${e.message}`);
      }
    }
    quoteCursor = batch[batch.length - 1].id;
    if (batch.length < 500) break;
  }

  // 扫描原文
  let otSuccess = 0;
  let otFailed = 0;
  const otErrors: string[] = [];
  let otCursor: number | undefined;
  let otScanned = 0;
  while (true) {
    if (limit && otScanned >= limit) break;
    const batch = await prisma.originalText.findMany({
      take: 100,
      select: { id: true, content: true },
      cursor: otCursor ? { id: otCursor } : undefined,
      skip: otCursor ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    if (batch.length === 0) break;

    for (const t of batch) {
      if (limit && otScanned >= limit) break;
      otScanned++;
      if (!containsTraditionalChinese(t.content)) continue;
      try {
        const simplified = tradToSimpl(t.content);
        if (simplified !== t.content) {
          await prisma.originalText.update({
            where: { id: t.id },
            data: { simplifiedContent: simplified },
          });
        }
        otSuccess++;
      } catch (e: any) {
        otFailed++;
        if (otErrors.length < 10) otErrors.push(`原文 ${t.id}: ${e.message}`);
      }
    }
    otCursor = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }

  const summary = {
    quotes: { total: quoteSuccess + quoteFailed, success: quoteSuccess, failed: quoteFailed, errors: quoteErrors },
    originalTexts: { total: otSuccess + otFailed, success: otSuccess, failed: otFailed, errors: otErrors },
    method: 'local' as const,
  };
  logger.info(`[OneClick Simplify] quotes=${quoteSuccess}/${quoteFailed}  originalTexts=${otSuccess}/${otFailed}`);
  return summary;
}

// ====== AI 自动分类 ======

const DEFAULT_CLASSIFY_PROMPT = `你是一个专业的内容分类助手。请根据以下文本内容，从给定的分类列表中选择最合适的分类（可多选，1-5个）。

可用分类列表（格式：ID | 分类名 | 维度 | 父分类）：
{categories}

待分类内容：
{content}

要求：
1. 从上面的分类列表中选择最匹配的分类，可以是多个
2. 综合考虑内容类型、主题、用途场景、时代等维度
3. 只返回JSON数组，元素为分类ID（数字），如 [1, 5, 12]
4. 不要返回任何其他内容、不要markdown代码块`;

/** 获取所有启用的分类，格式化为 AI 提示词中的列表文本 */
async function _getCategoryListText(): Promise<string> {
  const categories = await prisma.category.findMany({
    where: { status: 1 },
    orderBy: [{ type: 'asc' }, { sort: 'asc' }, { id: 'asc' }],
  });

  // 构建 parentId -> name 映射
  const nameMap = new Map<number, string>();
  for (const c of categories) nameMap.set(c.id, c.name);

  const lines = categories.map((c) => {
    const parentName = c.parentId ? nameMap.get(c.parentId) || '' : '';
    return `${c.id} | ${c.name} | ${c.type}${parentName ? ' | ' + parentName : ''}`;
  });
  return lines.join('\n');
}

/** 解析 AI 返回的分类 ID 数组 */
function _parseCategoryIds(raw: string): number[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  // 尝试提取 JSON 数组
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) cleaned = match[0];
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((v: unknown) => Number(v))
      .filter((n: number) => !isNaN(n) && n > 0);
  } catch {
    logger.error(`[AI Classify] 解析分类ID失败，原始返回: ${raw.slice(0, 200)}`);
    return [];
  }
}

/** 获取默认或指定的 AI 配置 */
async function _getConfig(configId?: number) {
  const config = configId
    ? await prisma.aiConfig.findUnique({ where: { id: configId } })
    : await prisma.aiConfig.findFirst({ where: { isDefault: true, isActive: true } });
  if (!config) throw new BusinessError(400, '未找到可用的 AI 配置', 400);
  return config;
}

/** 对单条金句进行AI分类 */
async function classifyQuote(quoteId: number, configId?: number) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new BusinessError(404, '金句不存在', 404);

  const config = await _getConfig(configId);
  const client = _buildClient(config);
  const categoryListText = await _getCategoryListText();
  const template = config.classifyPromptTemplate || DEFAULT_CLASSIFY_PROMPT;
  const prompt = template
    .replace('{categories}', categoryListText)
    .replace('{content}', quote.content);

  const raw = await client.chat([
    { role: 'system', content: '你是一个专业的内容分类助手，擅长分析文本并选择最合适的分类。' },
    { role: 'user', content: prompt },
  ]);

  const categoryIds = _parseCategoryIds(raw);
  if (categoryIds.length === 0) {
    throw new BusinessError(500, 'AI 返回分类解析失败', 500);
  }

  // 先删除旧关联，再写入新关联
  await prisma.quoteCategory.deleteMany({ where: { quoteId } });
  await prisma.quoteCategory.createMany({
    data: categoryIds.map((categoryId) => ({ quoteId, categoryId })),
  });

  logger.info(`[AI Classify] quote=${quoteId} categories=${JSON.stringify(categoryIds)}`);
  return { id: quoteId, categoryIds };
}

/** 批量对金句进行AI分类（串行） */
async function classifyQuotesBatch(quoteIds: number[], configId?: number) {
  const config = await _getConfig(configId);
  const client = _buildClient(config);
  const categoryListText = await _getCategoryListText();
  const template = config.classifyPromptTemplate || DEFAULT_CLASSIFY_PROMPT;

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const quoteId of quoteIds) {
    try {
      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) { failed++; errors.push(`金句 ${quoteId} 不存在`); continue; }

      const prompt = template
        .replace('{categories}', categoryListText)
        .replace('{content}', quote.content);

      const raw = await client.chat([
        { role: 'system', content: '你是一个专业的内容分类助手。' },
        { role: 'user', content: prompt },
      ]);

      const categoryIds = _parseCategoryIds(raw);
      if (categoryIds.length === 0) {
        failed++;
        errors.push(`金句 ${quoteId} 分类解析失败`);
        continue;
      }

      await prisma.quoteCategory.deleteMany({ where: { quoteId } });
      await prisma.quoteCategory.createMany({
        data: categoryIds.map((categoryId) => ({ quoteId, categoryId })),
      });
      success++;
      logger.info(`[AI Classify] progress ${success + failed}/${quoteIds.length}`);
    } catch (err) {
      failed++;
      errors.push(`金句 ${quoteId}: ${(err as Error).message}`);
    }
  }

  logger.info(`[AI Classify Batch] quotes total=${quoteIds.length} success=${success} failed=${failed}`);
  return { total: quoteIds.length, success, failed, errors: errors.slice(0, 10) };
}

/** 对单条原文进行AI分类 */
async function classifyOriginalText(originalTextId: number, configId?: number) {
  const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
  if (!original) throw new BusinessError(404, '原文不存在', 404);

  const config = await _getConfig(configId);
  const client = _buildClient(config);
  const categoryListText = await _getCategoryListText();
  const template = config.classifyPromptTemplate || DEFAULT_CLASSIFY_PROMPT;
  // 原文可能很长，截取前 2000 字
  const content = original.content.slice(0, 2000);
  const prompt = template
    .replace('{categories}', categoryListText)
    .replace('{content}', content);

  const raw = await client.chat([
    { role: 'system', content: '你是一个专业的内容分类助手，擅长分析文本并选择最合适的分类。' },
    { role: 'user', content: prompt },
  ]);

  const categoryIds = _parseCategoryIds(raw);
  if (categoryIds.length === 0) {
    throw new BusinessError(500, 'AI 返回分类解析失败', 500);
  }

  await prisma.originalTextCategory.deleteMany({ where: { originalTextId } });
  await prisma.originalTextCategory.createMany({
    data: categoryIds.map((categoryId) => ({ originalTextId, categoryId })),
  });

  logger.info(`[AI Classify] originalText=${originalTextId} categories=${JSON.stringify(categoryIds)}`);
  return { id: originalTextId, categoryIds };
}

/** 批量对原文进行AI分类（串行） */
async function classifyOriginalTextsBatch(originalTextIds: number[], configId?: number) {
  const config = await _getConfig(configId);
  const client = _buildClient(config);
  const categoryListText = await _getCategoryListText();
  const template = config.classifyPromptTemplate || DEFAULT_CLASSIFY_PROMPT;

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const originalTextId of originalTextIds) {
    try {
      const original = await prisma.originalText.findUnique({ where: { id: originalTextId } });
      if (!original) { failed++; errors.push(`原文 ${originalTextId} 不存在`); continue; }

      const content = original.content.slice(0, 2000);
      const prompt = template
        .replace('{categories}', categoryListText)
        .replace('{content}', content);

      const raw = await client.chat([
        { role: 'system', content: '你是一个专业的内容分类助手。' },
        { role: 'user', content: prompt },
      ]);

      const categoryIds = _parseCategoryIds(raw);
      if (categoryIds.length === 0) {
        failed++;
        errors.push(`原文 ${originalTextId} 分类解析失败`);
        continue;
      }

      await prisma.originalTextCategory.deleteMany({ where: { originalTextId } });
      await prisma.originalTextCategory.createMany({
        data: categoryIds.map((categoryId) => ({ originalTextId, categoryId })),
      });
      success++;
      logger.info(`[AI Classify] progress ${success + failed}/${originalTextIds.length}`);
    } catch (err) {
      failed++;
      errors.push(`原文 ${originalTextId}: ${(err as Error).message}`);
    }
  }

  logger.info(`[AI Classify Batch] originalTexts total=${originalTextIds.length} success=${success} failed=${failed}`);
  return { total: originalTextIds.length, success, failed, errors: errors.slice(0, 10) };
}

/** 一键分类所有未分类的金句和原文 */
async function oneClickClassifyAll(configId?: number, opts?: { limit?: number }) {
  const limit = opts?.limit;

  // 查找没有任何分类关联的金句
  const unclassifiedQuoteIds = (
    await prisma.quote.findMany({
      where: { quoteCategories: { none: {} } },
      select: { id: true },
      orderBy: { id: 'asc' },
      ...(limit ? { take: limit } : {}),
    })
  ).map((q: any) => q.id);

  // 查找没有任何分类关联的原文
  const unclassifiedOriginalTextIds = (
    await prisma.originalText.findMany({
      where: { originalTextCategories: { none: {} } },
      select: { id: true },
      orderBy: { id: 'asc' },
      ...(limit ? { take: limit } : {}),
    })
  ).map((t: any) => t.id);

  const quoteResult = unclassifiedQuoteIds.length
    ? await classifyQuotesBatch(unclassifiedQuoteIds, configId)
    : { total: 0, success: 0, failed: 0, errors: [] as string[] };

  const originalResult = unclassifiedOriginalTextIds.length
    ? await classifyOriginalTextsBatch(unclassifiedOriginalTextIds, configId)
    : { total: 0, success: 0, failed: 0, errors: [] as string[] };

  return {
    quotes: quoteResult,
    originalTexts: originalResult,
  };
}

/** 一键分类统计 */
async function getOneClickClassifyStats() {
  const [quotesUnclassified, originalTextsUnclassified] = await Promise.all([
    prisma.quote.count({ where: { quoteCategories: { none: {} } } }),
    prisma.originalText.count({ where: { originalTextCategories: { none: {} } } }),
  ]);
  return { quotesUnclassified, originalTextsUnclassified };
}

export {
  listConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  setDefaultConfig,
  listTasks,
  getTask,
  deleteTask,
  extractFromText,
  extractFromBatch,
  generatePinyinForQuote,
  generatePinyinForQuotesBatch,
  generatePinyinForOriginalText,
  generatePinyinForOriginalTextsBatch,
  simplifyText,
  simplifyQuote,
  simplifyQuotesBatch,
  simplifyOriginalText,
  simplifyOriginalTextsBatch,
  getOneClickStats,
  oneClickPinyinAll,
  oneClickExtractAll,
  oneClickSimplifyAllLocal,
  classifyQuote,
  classifyQuotesBatch,
  classifyOriginalText,
  classifyOriginalTextsBatch,
  oneClickClassifyAll,
  getOneClickClassifyStats,
};
