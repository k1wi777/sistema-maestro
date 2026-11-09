import type { ListQuery, Page } from '@gns/shared';
import type { PrismaPromise } from '../../generated/prisma/internal/prismaNamespace';
import type { PrismaService } from '../database/prisma.service';
import type { ReadRepository } from './repository';

export interface PageWindow {
  skip: number;
  take: number;
}

export function toPageWindow(page: number, pageSize: number): PageWindow {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function countPages(totalItems: number, pageSize: number): number {
  return Math.ceil(totalItems / pageSize);
}

/** Subconjunto del delegado de un modelo de Prisma que la base necesita. */
export interface ModelDelegate<TRow, TWhere> {
  findMany(args: {
    where?: TWhere;
    orderBy: Record<string, 'asc' | 'desc'>[];
    skip: number;
    take: number;
  }): PrismaPromise<TRow[]>;
  count(args: { where?: TWhere }): PrismaPromise<number>;
  findUnique(args: { where: { id: string } }): PromiseLike<TRow | null>;
}

/**
 * Base para los `prisma-*.repository.ts`: paginación, orden y conteo comunes.
 * Las subclases aportan el delegado, la traducción de filtros y el mapeo a entidad.
 */
export abstract class PrismaReadRepository<
  TRow,
  TWhere,
  TEntity,
  TFilters,
  TSortField extends string,
> implements ReadRepository<TEntity, TFilters, TSortField> {
  protected constructor(protected readonly prisma: PrismaService) {}

  protected abstract get delegate(): ModelDelegate<TRow, TWhere>;
  protected abstract toWhere(filters: TFilters): TWhere;
  protected abstract toEntity(row: TRow): TEntity;

  /**
   * Criterios de orden que siguen al elegido. Por defecto `id`; una subclase puede
   * anteponer uno de dominio (p. ej. el número de periodo) y debe terminar en `id`.
   */
  protected tieBreakers(field: TSortField): Record<string, 'asc' | 'desc'>[] {
    return field === 'id' ? [] : [{ id: 'asc' }];
  }

  async findById(id: string): Promise<TEntity | null> {
    const row = await this.delegate.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findPage(query: ListQuery<TFilters, TSortField>): Promise<Page<TEntity>> {
    const where = this.toWhere(query.filters);
    const { skip, take } = toPageWindow(query.page, query.pageSize);
    // Los desempates dan un orden total: sin ellos, valores repetidos en el
    // campo de orden repetirían u omitirían filas entre páginas.
    const orderBy: Record<string, 'asc' | 'desc'>[] = [
      { [query.sort.field]: query.sort.order },
      ...this.tieBreakers(query.sort.field),
    ];

    const [totalItems, rows] = await this.countAndFind(where, orderBy, skip, take);

    return {
      items: rows.map((row) => this.toEntity(row)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: totalItems,
      totalPages: countPages(totalItems, query.pageSize),
    };
  }

  private async countAndFind(
    where: TWhere,
    orderBy: Record<string, 'asc' | 'desc'>[],
    skip: number,
    take: number,
  ): Promise<[number, TRow[]]> {
    // El cliente de una transacción no tiene `$transaction`: dentro de una, las dos
    // consultas ya comparten la misma transacción.
    if (this.prisma.inTransaction) {
      const totalItems = await this.delegate.count({ where });
      const rows = await this.delegate.findMany({ where, orderBy, skip, take });
      return [totalItems, rows];
    }
    return this.prisma.$transaction([
      this.delegate.count({ where }),
      this.delegate.findMany({ where, orderBy, skip, take }),
    ]);
  }
}
