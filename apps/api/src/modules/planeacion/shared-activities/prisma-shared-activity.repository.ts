import { Injectable } from '@nestjs/common';
import {
  foldSearchText,
  SEARCH_FOLD_FROM,
  SEARCH_FOLD_TO,
  searchWords,
  type ListQuery,
  type Page,
  type SharedActivityFilters,
  type SharedActivitySortField,
} from '@gns/shared';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  PrismaReadRepository,
  type ModelDelegate,
} from '../../../shared/repository/prisma-read.repository';
import type {
  NewSharedActivity,
  SharedActivityChanges,
  SharedActivityRecord,
  SharedActivityRepository,
  SharedActivityView,
} from './shared-activity.repository';

// Autor sin correo; nivel y área solo con su nombre.
const INCLUDE = {
  author: { select: { id: true, fullName: true } },
  level: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
} satisfies Prisma.SharedActivityInclude;

type SharedActivityRow = Prisma.SharedActivityGetPayload<{ include: typeof INCLUDE }>;

/** Los ids que ya cumplen la búsqueda se suman a los demás filtros. */
interface SearchedFilters extends SharedActivityFilters {
  ids?: string[];
}

/** Columnas de texto donde busca `q` (identificadores fijos, nunca del cliente). */
const SEARCH_COLUMNS = ['titulo', 'objetivo', 'materiales', 'pasos'].map((name) =>
  Prisma.raw(name),
);

/** Escapa `\`, `%` y `_` para que el término se busque literalmente en `ILIKE`. */
const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (char) => `\\${char}`);

@Injectable()
export class PrismaSharedActivityRepository
  extends PrismaReadRepository<
    SharedActivityRow,
    Prisma.SharedActivityWhereInput,
    SharedActivityView,
    SearchedFilters,
    SharedActivitySortField
  >
  implements SharedActivityRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Con `q` primero se obtienen los ids que cumplen la búsqueda (SQL parametrizado) y después
   * se pagina con la base común. Secuencial y sin índice: el repositorio de un colegio es de
   * cientos o pocos miles de filas.
   */
  override async findPage(
    query: ListQuery<SearchedFilters, SharedActivitySortField>,
  ): Promise<Page<SharedActivityView>> {
    const { q, ...filters } = query.filters;
    if (q === undefined) {
      return super.findPage(query);
    }
    const ids = await this.searchIds(q);
    return super.findPage({ ...query, filters: { ...filters, ids } });
  }

  async findRecordById(id: string): Promise<SharedActivityRecord | null> {
    const row = await this.prisma.db.sharedActivity.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      authorId: row.authorId,
      levelId: row.levelId,
      areaId: row.areaId,
      title: row.title,
      objective: row.objective,
      durationMinutes: row.durationMinutes,
      materials: row.materials,
      steps: row.steps,
      link: row.link,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(input: NewSharedActivity): Promise<SharedActivityView> {
    const row = await this.prisma.db.sharedActivity.create({ data: input, include: INCLUDE });
    return this.toEntity(row);
  }

  async update(id: string, changes: SharedActivityChanges): Promise<SharedActivityView> {
    const row = await this.prisma.db.sharedActivity.update({
      where: { id },
      data: changes,
      include: INCLUDE,
    });
    return this.toEntity(row);
  }

  async lock(id: string): Promise<void> {
    await this.prisma.db
      .$queryRaw`SELECT id FROM actividad_repositorio WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async deleteWithFavorites(id: string): Promise<void> {
    await this.prisma.db.favoriteActivity.deleteMany({ where: { activityId: id } });
    await this.prisma.db.sharedActivity.delete({ where: { id } });
  }

  async findFavoriteIds(userId: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.db.favoriteActivity.findMany({
      where: { userId, activityId: { in: [...ids] } },
      select: { activityId: true },
    });
    return rows.map((row) => row.activityId);
  }

  async addFavorite(userId: string, activityId: string): Promise<void> {
    // INSERT ... ON CONFLICT DO NOTHING: repetir o competir con otra petición no falla.
    await this.prisma.db.favoriteActivity.createMany({
      data: [{ userId, activityId }],
      skipDuplicates: true,
    });
  }

  async removeFavorite(userId: string, activityId: string): Promise<void> {
    await this.prisma.db.favoriteActivity.deleteMany({ where: { userId, activityId } });
  }

  countFavorites(activityId: string): Promise<number> {
    return this.prisma.db.favoriteActivity.count({ where: { activityId } });
  }

  /**
   * Cada palabra debe aparecer en título, objetivo, materiales o pasos (AND entre palabras,
   * OR entre columnas). La columna y el término se pliegan igual: `translate` en la base y
   * `foldSearchText` en TypeScript; `ILIKE` ignora las mayúsculas.
   */
  private async searchIds(q: string): Promise<string[]> {
    const words = searchWords(q).map((word) => `%${escapeLike(foldSearchText(word))}%`);
    const conditions = words.map((pattern) => {
      const anyColumn = SEARCH_COLUMNS.map(
        (column) =>
          Prisma.sql`translate(${column}, ${SEARCH_FOLD_FROM}::text, ${SEARCH_FOLD_TO}::text) ILIKE ${pattern}::text`,
      );
      return Prisma.sql`(${Prisma.join(anyColumn, ' OR ')})`;
    });
    const rows = await this.prisma.db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM actividad_repositorio WHERE ${Prisma.join(conditions, ' AND ')}`,
    );
    return rows.map((row) => row.id);
  }

  // `ModelDelegate` no admite `include`: se envuelve el delegado para fijarlo en las lecturas.
  protected get delegate(): ModelDelegate<SharedActivityRow, Prisma.SharedActivityWhereInput> {
    const model = this.prisma.db.sharedActivity;
    return {
      findMany: (args) => model.findMany({ ...args, include: INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: INCLUDE }),
    };
  }

  protected toWhere(filters: SearchedFilters): Prisma.SharedActivityWhereInput {
    return {
      id: filters.ids ? { in: filters.ids } : undefined,
      authorId: filters.authorId,
      levelId: filters.levelId,
      areaId: filters.areaId,
      favorites: filters.favoriteOf ? { some: { userId: filters.favoriteOf } } : undefined,
    };
  }

  protected toEntity(row: SharedActivityRow): SharedActivityView {
    return {
      id: row.id,
      author: { id: row.author.id, fullName: row.author.fullName },
      level: row.level ? { id: row.level.id, name: row.level.name } : null,
      area: row.area ? { id: row.area.id, name: row.area.name } : null,
      title: row.title,
      objective: row.objective,
      durationMinutes: row.durationMinutes,
      materials: row.materials,
      steps: row.steps,
      link: row.link,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
