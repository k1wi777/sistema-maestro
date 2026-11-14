import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { PLANNING_YEAR } from './planning';
import { createTestUser, signIn, type Cookies, type TestUser } from './session';
import { call, createSection, type Created } from './training';

export interface OwnYear {
  code: string;
  /** Vuelve a dejar vigente el año de las pruebas de planeación. */
  restore(): Promise<void>;
}

/**
 * Deja un año propio como vigente. Quien lo usa debe tener el candado EXCLUSIVO del año lectivo:
 * así su ruta y sus planes (General incluidos) no se mezclan con los de otros archivos.
 */
export async function useOwnCurrentYear(app: INestApplication): Promise<OwnYear> {
  const prisma = app.get(PrismaService);
  // Rango propio (9100-9499): no choca con los años aleatorios 3000-8999 de otros archivos.
  const start = randomInt(9100, 9500);
  const code = `${start}-${start + 1}`;
  await prisma.schoolYear.createMany({ data: [{ code }], skipDuplicates: true });
  await prisma.schoolYear.updateMany({
    where: { code: { not: code }, isCurrent: true },
    data: { isCurrent: null },
  });
  await prisma.schoolYear.update({ where: { code }, data: { isCurrent: true } });
  return {
    code,
    restore: async () => {
      await prisma.schoolYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: null } });
      await prisma.schoolYear.updateMany({
        where: { code: PLANNING_YEAR },
        data: { isCurrent: true },
      });
    },
  };
}

/** Asignación activa directamente en la base, en un año dado. */
export async function assignInYear(
  app: INestApplication,
  teacherId: string,
  gradeId: string,
  areaId: string,
  schoolYear: string,
  status: 'activa' | 'retirada' = 'activa',
): Promise<void> {
  await app.get(PrismaService).teacherAssignment.create({
    data: { teacherId, gradeId, areaId, schoolYear, status, isHomeroomTeacher: false },
  });
}

export interface YearPlan {
  plan: Created;
  section: Created;
}

/** Plan (General si `areaId` es nulo) para un año, con una sección. */
export async function createPlanFor(
  app: INestApplication,
  coord: Cookies,
  schoolYear: string,
  areaId: string | null,
  name: string,
): Promise<YearPlan> {
  const res = await call(app, coord, 'post', '/training-plans').send({
    name,
    areaId,
    schoolYear,
  });
  if (res.status !== 201) {
    throw new Error(`No se pudo crear el plan: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const plan = res.body as Created;
  return { plan, section: await createSection(app, coord, plan.id, 'Sección') };
}

export interface YearTeacher {
  user: TestUser;
  cookies: Cookies;
}

export async function newTeacher(app: INestApplication): Promise<YearTeacher> {
  const user = await createTestUser(app);
  return { user, cookies: await signIn(app, user) };
}
