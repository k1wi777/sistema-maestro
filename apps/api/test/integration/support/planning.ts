import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { RecordStatus, type LessonPlan } from '@gns/shared';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { asUser, type Cookies } from './session';

/** Año vigente de las pruebas de planeación (todas lo comparten bajo el candado compartido). */
export const PLANNING_YEAR = '2031-2032';
const OTHER_YEAR = '2030-2031';

const LEVEL_ORDER: Record<string, number> = {
  'Preescolar bajo': 1,
  'Preescolar alto (KTF)': 2,
  Primaria: 3,
  Bachillerato: 4,
};

export type LessonPlanBody = LessonPlan;

/** Contenido mínimo para poder enviar una planeación. */
export const SUBMITTABLE_CONTENT = {
  expectedPerformance: 'Explica con sus palabras lo aprendido.',
  developmentMoment: 'Trabajo guiado con material concreto.',
};

const unique = () => randomUUID().slice(0, 8);

export interface Planning {
  year: string;
  /** Ids de los periodos 1 a 3 del año vigente. */
  periods: Record<1 | 2 | 3, string>;
  /** Periodo de un año que no es el vigente. */
  otherYearPeriodId: string;
  /** Crea un grado en el nivel (con el nombre del catálogo inicial si existe) y un área nueva. */
  gradeAndArea(levelName: string): Promise<{ gradeId: string; areaId: string }>;
  assign(
    teacherId: string,
    gradeId: string,
    areaId: string,
    status?: 'activa' | 'retirada',
  ): Promise<void>;
}

/**
 * Deja un año vigente con sus tres periodos y devuelve fábricas de grados, áreas y
 * asignaciones. Quien lo llama debe tener el candado compartido del año lectivo
 * (`holdSchoolYearLock('shared')`). Todas las escrituras toleran la carrera con otro
 * archivo de pruebas que haga lo mismo (`skipDuplicates`).
 */
export async function setupPlanning(app: INestApplication): Promise<Planning> {
  const prisma = app.get(PrismaService);
  await prisma.schoolYear.createMany({
    data: [{ code: PLANNING_YEAR }, { code: OTHER_YEAR }],
    skipDuplicates: true,
  });
  await prisma.schoolYear.updateMany({
    where: { code: { not: PLANNING_YEAR }, isCurrent: true },
    data: { isCurrent: null },
  });
  await prisma.schoolYear.update({ where: { code: PLANNING_YEAR }, data: { isCurrent: true } });
  await prisma.academicPeriod.createMany({
    data: [
      ...[1, 2, 3].map((number) => ({ schoolYear: PLANNING_YEAR, number })),
      { schoolYear: OTHER_YEAR, number: 1 },
    ],
    skipDuplicates: true,
  });
  const periods = await prisma.academicPeriod.findMany({
    where: { schoolYear: { in: [PLANNING_YEAR, OTHER_YEAR] } },
  });
  const periodId = (schoolYear: string, number: number) => {
    const found = periods.find((p) => p.schoolYear === schoolYear && p.number === number);
    if (!found) {
      throw new Error(`Falta el periodo ${number} de ${schoolYear}`);
    }
    return found.id;
  };

  return {
    year: PLANNING_YEAR,
    periods: {
      1: periodId(PLANNING_YEAR, 1),
      2: periodId(PLANNING_YEAR, 2),
      3: periodId(PLANNING_YEAR, 3),
    },
    otherYearPeriodId: periodId(OTHER_YEAR, 1),

    async gradeAndArea(levelName) {
      await prisma.educationLevel.createMany({
        data: [{ name: levelName, sortOrder: LEVEL_ORDER[levelName] ?? 9 }],
        skipDuplicates: true,
      });
      const level = await prisma.educationLevel.findUniqueOrThrow({ where: { name: levelName } });
      const grade = await prisma.grade.create({
        data: { name: `Grado ${unique()}`, levelId: level.id, sortOrder: 1 },
      });
      const area = await prisma.area.create({
        data: { name: `Área ${unique()}`, type: 'asignatura' },
      });
      return { gradeId: grade.id, areaId: area.id };
    },

    async assign(teacherId, gradeId, areaId, status = 'activa') {
      await prisma.teacherAssignment.create({
        data: { teacherId, gradeId, areaId, schoolYear: PLANNING_YEAR, status },
      });
    },
  };
}

/** Crea una planeación por la API y devuelve su cuerpo; falla la prueba si no responde 201. */
export async function createPlan(
  app: INestApplication,
  cookies: Cookies,
  body: Record<string, unknown>,
): Promise<LessonPlanBody> {
  const res = await asUser(app, 'post', '/lesson-plans', cookies, 'access').send(body);
  if (res.status !== 201) {
    throw new Error(`Se esperaba 201 y se recibió ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as LessonPlanBody;
}

/** Deja la planeación en el estado indicado escribiendo directamente en la base. */
export async function forceStatus(
  app: INestApplication,
  planId: string,
  status: RecordStatus,
): Promise<void> {
  await app
    .get(PrismaService)
    .lessonPlan.update({ where: { id: planId }, data: { status, submittedAt: new Date() } });
}

/** Filas de la bitácora de una entidad, en orden. */
export function auditRows(app: INestApplication, entityId: string) {
  return app.get(PrismaService).auditLog.findMany({ where: { entityId }, orderBy: { id: 'asc' } });
}
