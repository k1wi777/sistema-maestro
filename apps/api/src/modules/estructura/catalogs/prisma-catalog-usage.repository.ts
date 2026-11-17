import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { CatalogUsageRepository } from './catalog-usage.repository';

interface UsageRow {
  id: string;
  total: number;
}

// Filas que referencian cada elemento, una por referencia; se agrupan por id.
const GROUP_REFS = Prisma.sql`
  SELECT grupo_id AS id FROM asignacion_docente
  UNION ALL SELECT grupo_id FROM diario_campo`;
const GRADE_REFS = Prisma.sql`
  SELECT g.grado_id AS id FROM asignacion_docente ad JOIN grupo g ON g.id = ad.grupo_id
  UNION ALL SELECT grado_id FROM planeacion
  UNION ALL SELECT grado_id FROM diario_campo_historico
  UNION ALL SELECT g.grado_id FROM diario_campo dc JOIN grupo g ON g.id = dc.grupo_id
  UNION ALL SELECT grado_id FROM observador_anotacion
  UNION ALL SELECT grado_id FROM actividad_repositorio WHERE grado_id IS NOT NULL`;
const AREA_REFS = Prisma.sql`
  SELECT area_id AS id FROM asignacion_docente
  UNION ALL SELECT area_id FROM planeacion_area
  UNION ALL SELECT area_id FROM diario_anotacion
  UNION ALL SELECT area_id FROM actividad_repositorio WHERE area_id IS NOT NULL
  UNION ALL SELECT area_id FROM plan_formacion WHERE area_id IS NOT NULL`;

@Injectable()
export class PrismaCatalogUsageRepository implements CatalogUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  countGroup(groupId: string): Promise<number> {
    return this.count(GROUP_REFS, groupId);
  }

  countGrade(gradeId: string): Promise<number> {
    return this.count(GRADE_REFS, gradeId);
  }

  countArea(areaId: string): Promise<number> {
    return this.count(AREA_REFS, areaId);
  }

  groupUsage(): Promise<Map<string, number>> {
    return this.usage(GROUP_REFS);
  }

  gradeUsage(): Promise<Map<string, number>> {
    return this.usage(GRADE_REFS);
  }

  areaUsage(): Promise<Map<string, number>> {
    return this.usage(AREA_REFS);
  }

  private async count(refs: Prisma.Sql, id: string): Promise<number> {
    const rows = await this.prisma.db.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT count(*)::int AS total FROM (${refs}) AS refs WHERE refs.id = ${id}::uuid`,
    );
    return rows[0]?.total ?? 0;
  }

  private async usage(refs: Prisma.Sql): Promise<Map<string, number>> {
    const rows = await this.prisma.db.$queryRaw<UsageRow[]>(
      Prisma.sql`SELECT id::text AS id, count(*)::int AS total FROM (${refs}) AS refs GROUP BY id`,
    );
    return new Map(rows.map((row) => [row.id, row.total]));
  }
}
