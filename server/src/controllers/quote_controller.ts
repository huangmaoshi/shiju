import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import { AuthRequest } from '@/middlewares/auth_middleware';
import * as quoteService from '@/services/quote_service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const list = catchAsync(async (req, res) => {
  const { userId } = req as AuthRequest;
  const { page, pageSize, categoryId, keyword } = req.query as { page?: string; pageSize?: string; categoryId?: string; keyword?: string };
  const result = await quoteService.list(userId, {
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    keyword,
  });
  ok(res, result);
});

export const getById = catchAsync(async (req, res) => {
  const { userId } = req as AuthRequest;
  const id = Number(req.params.id);
  const result = await quoteService.getById(id, userId);
  ok(res, result);
});

export const random = catchAsync(async (req, res) => {
  const { userId } = req as AuthRequest;
  const { limit } = req.query as { limit?: string };
  const result = await quoteService.random(userId, limit ? Number(limit) : 10);
  ok(res, result);
});

export const create = catchAsync(async (req, res) => {
  const body = req.body || {};
  const quote = await prisma.quote.create({
    data: {
      content: body.content,
      author: body.author || null,
      source: body.source || null,
      sourceUrl: body.sourceUrl || null,
      isFree: body.isFree ?? true,
      isActive: body.isActive ?? true,
      provider: body.provider || "admin",
    },
  });
  if (body.categoryIds?.length) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        quoteCategories: {
          deleteMany: {},
          create: body.categoryIds.map((cid: number) => ({ categoryId: cid })),
        },
      },
    });
  }
  ok(res, quote);
});

export const update = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      content: body.content ?? undefined,
      author: body.author ?? undefined,
      source: body.source ?? undefined,
      sourceUrl: body.sourceUrl ?? undefined,
      isFree: body.isFree ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });
  if (body.categoryIds) {
    await prisma.quote.update({
      where: { id },
      data: {
        quoteCategories: {
          deleteMany: {},
          create: body.categoryIds.map((cid: number) => ({ categoryId: cid })),
        },
      },
    });
  }
  ok(res, quote);
});

export const remove = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.quote.update({
    where: { id },
    data: { quoteCategories: { deleteMany: {} } },
  });
  await prisma.quote.delete({ where: { id } });
  ok(res, null);
});

export const setStatus = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body as { isActive: boolean };
  const quote = await prisma.quote.update({
    where: { id },
    data: { isActive: !!isActive },
  });
  ok(res, quote);
});
