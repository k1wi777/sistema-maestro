import type { ListQuery } from '@gns/shared';
import type { PrismaService } from '../database/prisma.service';
import {
  PrismaReadRepository,
  countPages,
  toPageWindow,
  type ModelDelegate,
} from './prisma-read.repository';

describe('paginación de la base', () => {
  it('calcula skip y take', () => {
    expect(toPageWindow(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(toPageWindow(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it('calcula el total de páginas', () => {
    expect(countPages(0, 20)).toBe(0);
    expect(countPages(20, 20)).toBe(1);
    expect(countPages(21, 20)).toBe(2);
  });
});

describe('PrismaReadRepository.findPage', () => {
  interface Row {
    id: string;
  }

  const query: ListQuery<Record<string, never>, 'id'> = {
    page: 1,
    pageSize: 10,
    sort: { field: 'id', order: 'asc' },
    filters: {},
  };

  function setup(inTransaction: boolean) {
    const delegate = {
      count: jest.fn(() => Promise.resolve(2)),
      findMany: jest.fn(() => Promise.resolve([{ id: 'a' }, { id: 'b' }])),
      findUnique: jest.fn(),
    };
    const prisma = {
      inTransaction,
      db: { delegate },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    class TestRepository extends PrismaReadRepository<
      Row,
      object,
      Row,
      Record<string, never>,
      'id'
    > {
      constructor() {
        super(prisma as unknown as PrismaService);
      }
      protected get delegate() {
        return delegate as unknown as ModelDelegate<Row, object>;
      }
      protected toWhere() {
        return {};
      }
      protected toEntity(row: Row) {
        return row;
      }
    }
    return { repository: new TestRepository(), prisma, delegate };
  }

  it('batches count and rows in one $transaction outside a transaction', async () => {
    const { repository, prisma } = setup(false);
    const page = await repository.findPage(query);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(page).toMatchObject({ totalItems: 2, totalPages: 1, items: [{ id: 'a' }, { id: 'b' }] });
  });

  it('runs both queries directly inside an open transaction', async () => {
    const { repository, prisma, delegate } = setup(true);
    const page = await repository.findPage(query);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(delegate.count).toHaveBeenCalledTimes(1);
    expect(delegate.findMany).toHaveBeenCalledTimes(1);
    expect(page.totalItems).toBe(2);
  });
});
