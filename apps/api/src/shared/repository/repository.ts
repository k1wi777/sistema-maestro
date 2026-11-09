import type { ListQuery, Page } from '@gns/shared';

/**
 * Contrato de lectura que los servicios usan en lugar de Prisma.
 * No hay borrado genérico: la bitácora es de solo inserción y los registros
 * pedagógicos se anulan. Cada repository de dominio declara sus escrituras.
 */
export interface ReadRepository<TEntity, TFilters, TSortField extends string> {
  findById(id: string): Promise<TEntity | null>;
  findPage(query: ListQuery<TFilters, TSortField>): Promise<Page<TEntity>>;
}
