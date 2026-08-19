import { catchAsync } from '@/utils/async_handler';
import { ok } from '@/utils/response';
import * as categoryService from '@/services/category_service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const list = catchAsync(async (_req, res) => {
  const result = await categoryService.list();
  ok(res, result);
});

export const create = catchAsync(async (req, res) => {
  const { name, type, sort, parentId } = req.body || {};
  const category = await prisma.category.create({
    data: {
      name,
      type: type || "theme",
      sort: sort ?? 0,
      parentId: parentId ? Number(parentId) : null,
    },
  });
  ok(res, category);
});

export const update = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { name, type, sort, parentId } = req.body || {};
  const category = await prisma.category.update({
    where: { id },
    data: {
      name: name ?? undefined,
      type: type ?? undefined,
      sort: sort ?? undefined,
      parentId: parentId !== undefined ? (parentId ? Number(parentId) : null) : undefined,
    },
  });
  ok(res, category);
});

export const remove = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.category.delete({ where: { id } });
  ok(res, null);
});
