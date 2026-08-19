import { PrismaClient } from '@prisma/client';
import { BusinessError } from '@/middlewares/error_middleware';

const prisma = new PrismaClient();

interface CategoryNode {
    id: number;
    name: string;
    type: string;
    sort: number;
    status: number;
    children: CategoryNode[];
}

async function getAll(): Promise<Omit<CategoryNode, 'sort' | 'status'>[]> {
    const allCategories = await prisma.category.findMany({
        where: { status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });

    const map = new Map<number, CategoryNode>();
    for (const c of allCategories) {
        map.set(c.id, {
            id: c.id,
            name: c.name,
            type: c.type,
            sort: c.sort,
            status: c.status,
            children: [],
        });
    }

    const roots: CategoryNode[] = [];
    for (const c of allCategories) {
        const node = map.get(c.id)!;
        if (c.parentId == null) {
            roots.push(node);
        } else {
            const parent = map.get(c.parentId);
            if (parent) parent.children.push(node);
        }
    }

    return roots.map(stripInternal);
}

function stripInternal(node: CategoryNode): Omit<CategoryNode, 'sort' | 'status'> {
    return {
        id: node.id,
        name: node.name,
        type: node.type,
        children: node.children.map(stripInternal),
    };
}

const list = getAll;
export { getAll, list };
