import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import { todayInBogota } from '../../../src/shared/time/bogota-time';
import { call } from './formats';
import { PLANNING_YEAR } from './planning';
import { createTestUser, signIn, type Cookies, type TestUser } from './session';

export const TODAY = todayInBogota();
/** Año lectivo que contiene a hoy: el diario solo admite fechas hasta hoy dentro del año vigente. */
export const TODAY_YEAR = `${TODAY.slice(0, 4)}-${Number(TODAY.slice(0, 4)) + 1}`;

/** Cuerpo JSON del diario (las fechas viajan como texto). */
export interface JournalBody {
  id: string | null;
  status: string | null;
  date: string;
  schoolYear: string;
  period: { id: string; number: number } | null;
  group: { id: string; name: string };
  homeroomTeacher: { id: string; fullName: string } | null;
  submittedAt: string | null;
  readyCount: number;
  expectedCount: number;
  contributors: { teacher: { id: string }; status: string; areas: { name: string }[] }[];
  missing: { teacher: { id: string }; status: string }[];
  annotations: {
    id: string;
    teacher: { id: string };
    status: string;
    sent: boolean;
    isMine: boolean;
    description: string;
    observation: { text: string } | null;
  }[];
  generalObservation: { text: string } | null;
  signature: { reviewer: { id: string } } | null;
  history: { kind: string; detail: string | null }[];
  viewer: {
    isParticipant: boolean;
    isHomeroomTeacher: boolean;
    canAnnotate: boolean;
    canSubmit: boolean;
    canResubmit: boolean;
    canVoid: boolean;
    canReview: boolean;
    blockedReason: string | null;
  };
}

/**
 * Deja vigente un año lectivo que contiene a hoy. Quien lo usa debe tener el candado EXCLUSIVO del
 * año lectivo (`holdSchoolYearLock('exclusive')`).
 */
export async function useTodayYear(app: INestApplication): Promise<() => Promise<void>> {
  const prisma = app.get(PrismaService);
  await prisma.schoolYear.createMany({ data: [{ code: TODAY_YEAR }], skipDuplicates: true });
  await prisma.schoolYear.updateMany({
    where: { code: { not: TODAY_YEAR }, isCurrent: true },
    data: { isCurrent: null },
  });
  await prisma.schoolYear.update({ where: { code: TODAY_YEAR }, data: { isCurrent: true } });
  return async () => {
    await prisma.schoolYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: null } });
    await prisma.schoolYear.updateMany({
      where: { code: PLANNING_YEAR },
      data: { isCurrent: true },
    });
  };
}

export interface Actor {
  user: TestUser;
  cookies: Cookies;
}

export interface JournalWorld {
  gradeId: string;
  groupId: string;
  areas: { math: string; art: string; science: string };
  /** Director(a) de grupo (ciencias), Ana (matemáticas y arte) y Luis (arte). */
  director: Actor;
  ana: Actor;
  luis: Actor;
  coordinator: Actor;
  otherCoordinator: Actor;
  admin: Actor;
  stranger: Actor;
}

async function actor(app: INestApplication, role: UserRole = UserRole.Teacher): Promise<Actor> {
  const user = await createTestUser(app, { role });
  return { user, cookies: await signIn(app, user) };
}

/**
 * Grado y grupo propios con director(a) y dos docentes más, una coordinadora del grado, otra de
 * un grado distinto, administración y una docente sin asignación. Cada prueba arma el suyo.
 */
export async function journalWorld(app: INestApplication): Promise<JournalWorld> {
  const prisma = app.get(PrismaService);
  await prisma.educationLevel.createMany({
    data: [{ name: 'Primaria', sortOrder: 3 }],
    skipDuplicates: true,
  });
  const level = await prisma.educationLevel.findUniqueOrThrow({ where: { name: 'Primaria' } });
  const suffix = randomUUID().slice(0, 8);
  const grade = await prisma.grade.create({
    data: { name: `Grado ${suffix}`, levelId: level.id, sortOrder: randomInt(1, 90) },
  });
  const group = await prisma.group.create({ data: { gradeId: grade.id, name: `${grade.name} 1` } });
  const [math, art, science] = await Promise.all(
    ['Matemáticas', 'Arte', 'Ciencias'].map((name) =>
      prisma.area.create({ data: { name: `${name} ${suffix}`, type: 'asignatura' } }),
    ),
  );
  const [director, ana, luis, coordinator, otherCoordinator, admin, stranger] = [
    await actor(app),
    await actor(app),
    await actor(app),
    await actor(app, UserRole.Coordinator),
    await actor(app, UserRole.Coordinator),
    await actor(app, UserRole.Administrator),
    await actor(app),
  ] as [Actor, Actor, Actor, Actor, Actor, Actor, Actor];
  await prisma.grade.update({
    where: { id: grade.id },
    data: { coordinatorId: coordinator.user.id },
  });

  const assign = (teacherId: string, areaId: string, isHomeroomTeacher = false) =>
    prisma.teacherAssignment.create({
      data: { teacherId, groupId: group.id, areaId, schoolYear: TODAY_YEAR, isHomeroomTeacher },
    });
  await assign(director.user.id, science!.id, true);
  await assign(ana.user.id, math!.id);
  await assign(ana.user.id, art!.id);
  await assign(luis.user.id, art!.id);

  return {
    gradeId: grade.id,
    groupId: group.id,
    areas: { math: math!.id, art: art!.id, science: science!.id },
    director,
    ana,
    luis,
    coordinator,
    otherCoordinator,
    admin,
    stranger,
  };
}

/** Anotación mínima válida del día (o la fecha pedida) en el grupo del mundo. */
export const annotationBody = (
  world: JournalWorld,
  areaId: string,
  patch: Record<string, unknown> = {},
) => ({
  groupId: world.groupId,
  date: TODAY,
  areaId,
  description: 'Trabajo en equipo durante la clase.',
  ...patch,
});

/** Agrega una anotación y devuelve el diario; falla la prueba si no responde 201. */
export async function addAnnotation(
  app: INestApplication,
  who: Actor,
  body: Record<string, unknown>,
): Promise<JournalBody> {
  const res = await call(app, who.cookies, 'post', '/field-journals/annotations').send(body);
  if (res.status !== 201) {
    throw new Error(`Se esperaba 201 y se recibió ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as JournalBody;
}

export const annotationOf = (journal: JournalBody, teacherId: string) => {
  const found = journal.annotations.find((annotation) => annotation.teacher.id === teacherId);
  if (!found) {
    throw new Error('El diario no trae la anotación del docente');
  }
  return found;
};

/** Marca lista la anotación (200) y devuelve el diario. */
export async function markReady(
  app: INestApplication,
  who: Actor,
  journalId: string,
  annotationId: string,
): Promise<JournalBody> {
  const res = await call(
    app,
    who.cookies,
    'post',
    `/field-journals/${journalId}/annotations/${annotationId}/ready`,
  ).expect(200);
  return res.body as JournalBody;
}

/** Ana y Luis anotan hoy y solo Ana marca lista; el diario queda En curso. */
export async function startedJournal(app: INestApplication, world: JournalWorld) {
  const first = await addAnnotation(app, world.ana, annotationBody(world, world.areas.math));
  const journalId = first.id!;
  await addAnnotation(app, world.luis, annotationBody(world, world.areas.art));
  const mine = annotationOf(first, world.ana.user.id);
  await markReady(app, world.ana, journalId, mine.id);
  return { journalId, anaAnnotationId: mine.id };
}

/** El diario de `startedJournal` ya enviado por el director(a). */
export async function submittedJournal(app: INestApplication, world: JournalWorld) {
  const started = await startedJournal(app, world);
  await call(
    app,
    world.director.cookies,
    'post',
    `/field-journals/${started.journalId}/submit`,
  ).expect(200);
  return started;
}
