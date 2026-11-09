import { z } from 'zod';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export interface ListQuery<TFilters, TSortField extends string> {
  page: number;
  pageSize: number;
  sort: { field: TSortField; order: SortOrder };
  filters: TFilters;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Esquema de `Page<T>` para documentar y serializar las respuestas de los listados. */
export function createPageSchema<TItem extends z.ZodType>(itemSchema: TItem) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
  });
}

/**
 * Booleano de query string. `z.coerce.boolean` convertiría "false" en true,
 * por eso solo se aceptan los textos "true" y "false".
 */
export const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');

const queryInteger = (min: number, max: number, defaultValue: number) =>
  z
    .string()
    .regex(/^\d+$/, 'debe ser un entero')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .default(defaultValue);

interface BaseQuery<TSortField extends string> {
  page: number;
  pageSize: number;
  sortBy: TSortField;
  sortOrder: SortOrder;
}

type FilterShape = Record<string, z.ZodType>;

export interface ListQueryOptions<TSortField extends string, TFilters extends FilterShape> {
  /** Campos por los que se puede ordenar el listado. */
  sortFields: readonly [TSortField, ...TSortField[]];
  defaultSort: { field: TSortField; order: SortOrder };
  /** Filtros del listado: un esquema Zod por parámetro de la query. */
  filters?: TFilters;
}

/**
 * Crea el esquema de la query de un listado. Es estricto: rechaza parámetros
 * desconocidos, campos de orden no permitidos y valores fuera de rango.
 * Produce un `ListQuery` listo para el repository.
 */
export function createListQuerySchema<
  TSortField extends string,
  TFilters extends FilterShape = Record<never, never>,
>(options: ListQueryOptions<TSortField, TFilters>) {
  const filterShape = (options.filters ?? {}) as TFilters;
  const filterKeys = Object.keys(filterShape);

  return z
    .strictObject({
      page: queryInteger(1, Number.MAX_SAFE_INTEGER, DEFAULT_PAGE),
      pageSize: queryInteger(1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
      sortBy: z.enum(options.sortFields).default(options.defaultSort.field),
      sortOrder: z.enum(SORT_ORDERS).default(options.defaultSort.order),
      ...filterShape,
    })
    .transform((value) => {
      // Los genéricos de los filtros impiden a TypeScript ver las claves fijas.
      const query = value as unknown as BaseQuery<TSortField>;
      const raw = value as Record<string, unknown>;
      const filters = Object.fromEntries(
        filterKeys.filter((key) => raw[key] !== undefined).map((key) => [key, raw[key]]),
      ) as { [K in keyof TFilters]?: z.output<TFilters[K]> };
      const result: ListQuery<typeof filters, TSortField> = {
        page: query.page,
        pageSize: query.pageSize,
        sort: { field: query.sortBy, order: query.sortOrder },
        filters,
      };
      return result;
    });
}
