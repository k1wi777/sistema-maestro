import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { RecordStatus, type Review } from '@gns/shared';
import { PrismaService } from '../../../src/shared/database/prisma.service';
import type { Planning } from './planning';
import { asUser, type Cookies } from './session';

/** Cuerpo JSON de una entrada: las fechas llegan como texto ISO. */
export interface EntryBody {
  id: string;
  date: string;
  lesson: string | null;
  eventType: string;
  students: string[];
  description: string;
  actions: string | null;
  reflection: string | null;
}

/** Cuerpo JSON de la hoja con sus entradas. */
export interface JournalBody {
  id: string;
  teacher: { id: string; fullName: string };
  grade: { id: string; name: string };
  period: { id: string; number: number; schoolYear: string };
  status: RecordStatus;
  submittedAt: string | null;
  entryCount: number;
  entries: EntryBody[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteBody {
  id: string;
  teacher: { id: string; fullName: string };
  grade: { id: string; name: string };
  studentFirstName: string;
  date: string;
  type: string;
  description: string;
  studentVersion: string | null;
  actions: string | null;
  familyInformed: boolean;
  followUp: string | null;
  status: RecordStatus;
}

/** Revisión como la sirve la API (la fecha viaja como texto). */
export type ReviewBody = Omit<Review, 'date'> & { date: string };

/** Entrada mínima válida. */
export const ENTRY_CONTENT = {
  date: '2031-03-10',
  lesson: 'Matemáticas',
  eventType: 'grupo',
  description: 'Trabajo en equipo durante la clase.',
};

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

export const createJournal = (
  app: INestApplication,
  cookies: Cookies,
  body: Record<string, unknown>,
): Promise<JournalBody> =>
  call(app, cookies, 'post', '/field-journals')
    .send(body)
    .then((res) => expectCreated<JournalBody>(res));

/** Agrega una entrada por la API y devuelve la hoja; falla la prueba si no responde 201. */
export const addEntry = (
  app: INestApplication,
  cookies: Cookies,
  journalId: string,
  body: Record<string, unknown> = {},
): Promise<JournalBody> =>
  call(app, cookies, 'post', `/field-journals/${journalId}/entries`)
    .send({ ...ENTRY_CONTENT, ...body })
    .then((res) => expectCreated<JournalBody>(res));

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
 * tenga su combinación docente + grado + periodo sin choques con otras.
 */
export async function freshGrade(
  planning: Planning,
  teacherIds: string[],
): Promise<{ gradeId: string; areaId: string }> {
  const target = await planning.gradeAndArea('Primaria');
  for (const id of teacherIds) {
    await planning.assign(id, target.gradeId, target.areaId);
  }
  return target;
}

/** Hoja del docente con una entrada y ya enviada (lista para revisar). */
export async function submittedJournal(
  app: INestApplication,
  planning: Planning,
  teacher: { id: string },
  cookies: Cookies,
  entries: Record<string, unknown>[] = [{}],
): Promise<JournalBody> {
  const { gradeId } = await freshGrade(planning, [teacher.id]);
  const journal = await createJournal(app, cookies, { gradeId, periodId: planning.periods[1] });
  for (const entry of entries) {
    await addEntry(app, cookies, journal.id, entry);
  }
  await call(app, cookies, 'post', `/field-journals/${journal.id}/submit`).expect(200);
  return journal;
}

/** Anotación del docente ya enviada. */
export async function submittedNote(
  app: INestApplication,
  planning: Planning,
  cookies: Cookies,
  body: Record<string, unknown> = {},
): Promise<NoteBody> {
  const { gradeId } = await freshGrade(planning, []);
  const note = await createNote(app, cookies, { gradeId, ...body });
  await call(app, cookies, 'post', `/observer-notes/${note.id}/submit`).expect(200);
  return note;
}

/** Deja el registro en el estado indicado escribiendo directamente en la base. */
export async function forceJournalStatus(
  app: INestApplication,
  journalId: string,
  status: RecordStatus,
): Promise<void> {
  await app
    .get(PrismaService)
    .fieldJournal.update({ where: { id: journalId }, data: { status, submittedAt: new Date() } });
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
