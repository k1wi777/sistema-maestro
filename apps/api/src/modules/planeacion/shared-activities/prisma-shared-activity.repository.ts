import { Injectable } from '@nestjs/common';
import {
  foldSearchText,
  SEARCH_FOLD_FROM,
  SEARCH_FOLD_TO,
  SHARED_ACTIVITY_CORNERS_MAX_ITEMS,
  SharedActivityType,
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

// Autor sin correo; nivel, área y grado solo con su nombre.
const INCLUDE = {
  author: { select: { id: true, fullName: true } },
  level: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  grade: { select: { id: true, name: true } },
} satisfies Prisma.SharedActivityInclude;

type SharedActivityRow = Prisma.SharedActivityGetPayload<{ include: typeof INCLUDE }>;

/** Los ids que ya cumplen la búsqueda de texto y de rincón se suman a los demás filtros. */
interface SearchedFilters extends SharedActivityFilters {
  ids?: string[];
}

/** Columnas de texto donde busca `q` (identificadores fijos, nunca del cliente). */
const SEARCH_COLUMNS = ['titulo', 'objetivo', 'materiales', 'pasos', 'rincon'].map((name) =>
  Prisma.raw(name),
);

/** Escapa `\`, `%` y `_` para que el término se busque literalmente en `ILIKE`. */
/** Rincón plegado (sin tildes, mayúsculas ni espacios en los extremos) para comparar y agrupar. */
const FOLDED_CORNER = Prisma.sql`lower(translate(btrim(rincon), ${SEARCH_FOLD_FROM}::text, ${SEARCH_FOLD_TO}::text))`;

const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (char) => `\\${char}`);

const ACTIVITY_TYPES: readonly string[] = Object.values(SharedActivityType);

/** La columna es texto: el CHECK de la base garantiza que sea uno de los valores admitidos. */
const toActivityType = (value: string): SharedActivityType => {
  if (!ACTIVITY_TYPES.includes(value)) {
    throw new Error(`Tipo de actividad inesperado: ${value}`);
  }
  return value as SharedActivityType;
};

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
    const { q, learningCorner, ...filters } = query.filters;
    if (q === undefined && learningCorner === undefined) {
      return super.findPage(query);
    }
    const ids = await this.findMatchingIds(q, learningCorner);
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
      gradeId: row.gradeId,
      learningCorner: row.learningCorner,
      activityType: toActivityType(row.activityType),
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

  async findCorners(levelId?: string): Promise<string[]> {
    const where = levelId ? Prisma.sql`AND nivel_id = ${levelId}::uuid` : Prisma.empty;
    // Un valor por rincón plegado: el texto visible es el de la variante más reciente.
    const rows = await this.prisma.db.$queryRaw<{ rincon: string }[]>(Prisma.sql`
      SELECT rincon FROM (
        SELECT DISTINCT ON (folded) rincon FROM (
          SELECT btrim(rincon) AS rincon, ${FOLDED_CORNER} AS folded, actualizado_en
          FROM actividad_repositorio
          WHERE rincon IS NOT NULL AND btrim(rincon) <> '' ${where}
        ) AS candidates
        ORDER BY folded, actualizado_en DESC
      ) AS corners
      ORDER BY lower(rincon), rincon
      LIMIT ${SHARED_ACTIVITY_CORNERS_MAX_ITEMS}
    `);
    return rows.map((row) => row.rincon);
  }

  /**
   * Cada palabra debe aparecer en título, objetivo, materiales, pasos o rincón (AND entre
   * palabras, OR entre columnas) y el rincón, si se filtra, debe coincidir al plegarlo. La
   * columna y el término se pliegan igual: `translate` en la base y `foldSearchText` en
   * TypeScript; `ILIKE` ignora las mayúsculas.
   */
  private async findMatchingIds(q?: string, learningCorner?: string): Promise<string[]> {
    const conditions: Prisma.Sql[] = searchWords(q ?? '')
      .map((word) => `%${escapeLike(foldSearchText(word))}%`)
      .map((pattern) => {
        const anyColumn = SEARCH_COLUMNS.map(
          (column) =>
            Prisma.sql`translate(${column}, ${SEARCH_FOLD_FROM}::text, ${SEARCH_FOLD_TO}::text) ILIKE ${pattern}::text`,
        );
        return Prisma.sql`(${Prisma.join(anyColumn, ' OR ')})`;
      });
    if (learningCorner !== undefined) {
      conditions.push(
        Prisma.sql`${FOLDED_CORNER} = lower(${foldSearchText(learningCorner)}::text)`,
      );
    }
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
      activityType: filters.activityType,
      // Un grado incluye las actividades de todo el nivel (sin grado) de su nivel.
      OR: filters.gradeId
        ? [{ gradeId: filters.gradeId }, { gradeId: null, levelId: filters.gradeLevelId ?? null }]
        : undefined,
      favorites: filters.favoriteOf ? { some: { userId: filters.favoriteOf } } : undefined,
    };
  }

  protected toEntity(row: SharedActivityRow): SharedActivityView {
    return {
      id: row.id,
      author: { id: row.author.id, fullName: row.author.fullName },
      level: row.level ? { id: row.level.id, name: row.level.name } : null,
      area: row.area ? { id: row.area.id, name: row.area.name } : null,
      grade: row.grade ? { id: row.grade.id, name: row.grade.name } : null,
      learningCorner: row.learningCorner,
      activityType: toActivityType(row.activityType),
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
