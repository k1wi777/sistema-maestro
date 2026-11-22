import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { RecordStatus, type Review } from '@gns/shared';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import type { Planning } from './planning';
import { asUser, type Cookies } from './session';

export interface NoteBody {
  id: string;
  teacher: { id: string; fullName: string };
  grade: { id: string; name: string };
  studentFirstName: string;
  date: string;
  type: string;
  description: string;
  studentVersion: string | null;
  pedagogicalStrategies: string | null;
  actions: string | null;
  familyInformed: boolean;
  followUp: string | null;
  status: RecordStatus;
}

/** Revisión como la sirve la API (la fecha viaja como texto). */
export type ReviewBody = Omit<Review, 'date'> & { date: string };

/** Anotación mínima válida (el grado se completa en cada prueba). */
export const NOTE_CONTENT = {
  studentFirstName: 'Sofía',
  date: '2031-03-10',
  type: 'positiva',
  description: 'Ayudó a un compañero con la tarea.',
};

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Pide una ruta con la sesión del usuario (solo cookie de acceso). */
export const call = (app: INestApplication, cookies: Cookies, method: Method, path: string) =>
  asUser(app, method, path, cookies, 'access');

function expectCreated<T>(res: { status: number; body: unknown }): T {
  if (res.status !== 201) {
    throw new Error(`Se esperaba 201 y se recibió ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as T;
}

export const createNote = (
  app: INestApplication,
  cookies: Cookies,
  body: Record<string, unknown>,
): Promise<NoteBody> =>
  call(app, cookies, 'post', '/observer-notes')
    .send({ ...NOTE_CONTENT, ...body })
    .then((res) => expectCreated<NoteBody>(res));

/**
 * Crea un grado (y un área) propios y asigna a los docentes indicados, para que cada prueba
 * tenga su combinación docente + grado sin choques con otras.
 */
export async function freshGrade(
  planning: Planning,
  teacherIds: string[],
  coordinatorId: string | null = null,
): Promise<{ gradeId: string; areaId: string }> {
  const target = await planning.gradeAndArea('Primaria', coordinatorId);
  for (const id of teacherIds) {
    await planning.assign(id, target.gradeId, target.areaId);
  }
  return target;
}

/** Anotación del docente ya enviada, en un grado nuevo (con `coordinatorId` como coordinadora). */
export async function submittedNote(
  app: INestApplication,
  planning: Planning,
  cookies: Cookies,
  body: Record<string, unknown> = {},
  coordinatorId: string | null = null,
): Promise<NoteBody> {
  const { gradeId } = await freshGrade(planning, [], coordinatorId);
  const note = await createNote(app, cookies, { gradeId, ...body });
  await call(app, cookies, 'post', `/observer-notes/${note.id}/submit`).expect(200);
  return note;
}

export async function forceNoteStatus(
  app: INestApplication,
  noteId: string,
  status: RecordStatus,
): Promise<void> {
  await app.get(PrismaService).observerNote.update({ where: { id: noteId }, data: { status } });
}

export const unknownId = (): string => randomUUID();

/** Filas de `revision` de un registro, en orden. */
export function reviewRows(app: INestApplication, recordId: string) {
  return app.get(PrismaService).review.findMany({
    where: { recordId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
}
