import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import {
  AnnotationStatus,
  ContributionStatus,
  JournalHistoryKind,
  JournalStatus,
} from '../constants/field-journal';
import { createListQuerySchema, createPageSchema } from '../list-query/list-query';
import {
  coordinatorFilterSchema,
  REVIEW_COMMENT_MAX_LENGTH,
  voidRecordSchema,
} from '../review/review';

export const JOURNAL_DESCRIPTION_MAX_LENGTH = 1500;
export const JOURNAL_OBSERVATIONS_MAX = 200;
export const JOURNAL_OBSERVATION_MAX_LENGTH = 1000;

const uuid = z.uuid({ error: 'debe ser un UUID' });
const day = z.iso.date({ error: 'debe ser una fecha AAAA-MM-DD' });
const journalStatusSchema = z.enum(
  Object.values(JournalStatus) as [JournalStatus, ...JournalStatus[]],
  { error: 'estado no permitido' },
);
const annotationStatusSchema = z.enum(
  Object.values(AnnotationStatus) as [AnnotationStatus, ...AnnotationStatus[]],
);
const contributionStatusSchema = z.enum(
  Object.values(ContributionStatus) as [ContributionStatus, ...ContributionStatus[]],
);
const historyKindSchema = z.enum(
  Object.values(JournalHistoryKind) as [JournalHistoryKind, ...JournalHistoryKind[]],
);

const requiredText = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .min(1, 'es obligatorio')
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`);

const person = z.object({ id: z.uuid(), fullName: z.string() });
const named = z.object({ id: z.uuid(), name: z.string() });

// ---------- Entradas ----------

/** Contenido de una anotación tal como lo edita su autor: clase y descripción de eventos (F-PA-05). */
const annotationContentShape = {
  areaId: uuid.optional(),
  description: requiredText(JOURNAL_DESCRIPTION_MAX_LENGTH).optional(),
};

/**
 * Alta: crea el diario del grupo y la fecha si aún no existe (con la primera anotación).
 * `.strict()` rechaza con 400 cualquier otro campo (tipo de evento, estudiantes, acciones…).
 */
export const createAnnotationSchema = z
  .object({
    ...annotationContentShape,
    groupId: uuid,
    date: day,
    areaId: uuid,
    description: requiredText(JOURNAL_DESCRIPTION_MAX_LENGTH),
  })
  .strict();
export type CreateAnnotationInput = z.output<typeof createAnnotationSchema>;

/** PATCH parcial: al menos un campo de los dos. */
export const updateAnnotationSchema = z
  .object(annotationContentShape)
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'debe incluir al menos un campo' });
export type UpdateAnnotationInput = z.output<typeof updateAnnotationSchema>;

export const annotationParamSchema = z.object({ id: uuid, annotationId: uuid });

/** Anular un diario: el motivo queda en la bitácora (igual que los demás registros). */
export const voidJournalSchema = voidRecordSchema;

const comment = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(REVIEW_COMMENT_MAX_LENGTH, `debe tener como máximo ${REVIEW_COMMENT_MAX_LENGTH} caracteres`)
  .transform((value) => value || null);

export const approveJournalSchema = z.object({ comment: comment.optional() }).strict();
export type ApproveJournalInput = z.output<typeof approveJournalSchema>;

/** Devolver: observación general y/o por anotación; al menos una. Coordinación no reescribe textos. */
export const returnJournalSchema = z
  .object({
    comment: comment.optional(),
    observations: z
      .array(
        z
          .object({
            annotationId: uuid,
            text: requiredText(JOURNAL_OBSERVATION_MAX_LENGTH),
          })
          .strict(),
      )
      .max(JOURNAL_OBSERVATIONS_MAX, `como máximo ${JOURNAL_OBSERVATIONS_MAX} observaciones`)
      .default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.observations.map((observation) => observation.annotationId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['observations'],
        message: 'no puede repetir anotaciones',
      });
    }
    if (!value.comment && value.observations.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['observations'],
        message: 'debe incluir al menos una observación (general o sobre una anotación)',
      });
    }
  });
export type ReturnJournalInput = z.output<typeof returnJournalSchema>;

// ---------- Salidas ----------

const groupRef = named;
const viewerSchema = z.object({
  isParticipant: z.boolean(),
  isHomeroomTeacher: z.boolean(),
  /** Asignaturas con que el docente puede anotar en este grupo. */
  areas: z.array(named),
  canAnnotate: z.boolean(),
  canSubmit: z.boolean(),
  canResubmit: z.boolean(),
  canVoid: z.boolean(),
  canReview: z.boolean(),
  /** Motivo, en español, por el que el envío está bloqueado (p. ej. sin director(a)). */
  blockedReason: z.string().nullable(),
});
export type JournalViewer = z.output<typeof viewerSchema>;

const annotationObservationSchema = z.object({
  text: z.string(),
  reviewer: person,
  date: isoDateTimeSchema,
});

export const journalAnnotationSchema = z.object({
  id: z.uuid(),
  teacher: person,
  area: named,
  description: z.string(),
  status: annotationStatusSchema,
  readyAt: isoDateTimeSchema.nullable(),
  /** Viajó en algún envío; falso en un borrador que quedó fuera («No enviada»). */
  sent: z.boolean(),
  isMine: z.boolean(),
  observation: annotationObservationSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type JournalAnnotation = z.output<typeof journalAnnotationSchema>;

const contributorSchema = z.object({
  teacher: person,
  areas: z.array(named),
  status: contributionStatusSchema,
  readyAt: isoDateTimeSchema.nullable(),
});
export type JournalContributor = z.output<typeof contributorSchema>;

const missingSchema = z.object({
  teacher: person,
  areas: z.array(z.string()),
  /** `draft`: tenía anotaciones en borrador; `none`: no aportó. */
  status: z.enum([ContributionStatus.Draft, ContributionStatus.None]),
});
export type JournalMissing = z.output<typeof missingSchema>;

const historyItemSchema = z.object({
  kind: historyKindSchema,
  at: isoDateTimeSchema,
  actor: person.nullable(),
  /** Solo datos (n de m aportes, número de observaciones); nunca textos de anotaciones. */
  detail: z.string().nullable(),
});
export type JournalHistoryItem = z.output<typeof historyItemSchema>;

const headerShape = {
  schoolYear: z.string(),
  /** Período académico que contiene la fecha del diario; nulo si ninguno la contiene. */
  period: z.object({ id: z.uuid(), number: z.number().int() }).nullable(),
  level: named,
  grade: named,
  group: groupRef,
  date: z.string(),
  homeroomTeacher: person.nullable(),
  submittedAt: isoDateTimeSchema.nullable(),
  readyCount: z.number().int(),
  expectedCount: z.number().int(),
  contributors: z.array(contributorSchema),
  missing: z.array(missingSchema),
  annotations: z.array(journalAnnotationSchema),
  generalObservation: z
    .object({ text: z.string(), reviewer: person, date: isoDateTimeSchema })
    .nullable(),
  signature: z.object({ reviewer: person, date: isoDateTimeSchema }).nullable(),
  history: z.array(historyItemSchema),
  viewer: viewerSchema,
};

export const fieldJournalSchema = z.object({
  id: z.uuid(),
  status: journalStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  ...headerShape,
});
export type FieldJournal = z.output<typeof fieldJournalSchema>;

/** El diario de un día: `id` y `status` nulos mientras nadie ha agregado la primera anotación. */
export const fieldJournalDaySchema = z.object({
  id: z.uuid().nullable(),
  status: journalStatusSchema.nullable(),
  createdAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema.nullable(),
  ...headerShape,
});
export type FieldJournalDay = z.output<typeof fieldJournalDaySchema>;

/** Diario en los listados: sin anotaciones ni textos. */
export const fieldJournalSummarySchema = z.object({
  id: z.uuid(),
  group: groupRef,
  grade: named,
  date: z.string(),
  status: journalStatusSchema,
  homeroomTeacher: person.nullable(),
  /** Aportes: los del último envío si ya se envió; si no, los actuales. */
  readyCount: z.number().int(),
  expectedCount: z.number().int(),
  submittedAt: isoDateTimeSchema.nullable(),
  reviewer: person.nullable(),
  reviewedAt: isoDateTimeSchema.nullable(),
  /** Observaciones de coordinación sobre anotaciones del usuario que consulta. */
  myObservationCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type FieldJournalSummary = z.output<typeof fieldJournalSummarySchema>;

export const fieldJournalPageSchema = createPageSchema(fieldJournalSummarySchema);

/** Bloque «Hoy» del docente: por cada uno de sus grupos, el diario de hoy si existe. */
export const todayJournalsSchema = z.object({
  date: z.string(),
  groups: z.array(
    z.object({
      group: groupRef,
      grade: named,
      isHomeroomTeacher: z.boolean(),
      areas: z.array(named),
      journal: fieldJournalSummarySchema.nullable(),
    }),
  ),
});
export type TodayJournals = z.output<typeof todayJournalsSchema>;

/** Alcance de revisión de coordinación: cifras por estado y grados y grupos que ve. */
export const journalReviewScopeSchema = z.object({
  /** Administración ve todos los grados y grupos. */
  unrestricted: z.boolean(),
  counts: z.object({
    submitted: z.number().int(),
    changesRequested: z.number().int(),
    reviewed: z.number().int(),
  }),
  grades: z.array(named),
  groups: z.array(z.object({ id: z.uuid(), name: z.string(), gradeId: z.uuid() })),
});
export type JournalReviewScope = z.output<typeof journalReviewScopeSchema>;

export const fieldJournalDayQuerySchema = z.strictObject({ groupId: uuid, date: day });

export const JOURNAL_SCOPES = ['mine', 'review'] as const;
export type JournalScope = (typeof JOURNAL_SCOPES)[number];

export const FIELD_JOURNAL_SORT_FIELDS = ['date', 'submittedAt', 'updatedAt'] as const;
export type FieldJournalSortField = (typeof FIELD_JOURNAL_SORT_FIELDS)[number];
export const fieldJournalListQuerySchema = createListQuerySchema({
  sortFields: FIELD_JOURNAL_SORT_FIELDS,
  defaultSort: { field: 'date', order: 'desc' },
  filters: {
    scope: z.enum(JOURNAL_SCOPES).optional(),
    status: journalStatusSchema.optional(),
    gradeId: uuid.optional(),
    groupId: uuid.optional(),
    from: day.optional(),
    to: day.optional(),
    coordinatorId: coordinatorFilterSchema.optional(),
  },
});
export interface FieldJournalFilters {
  /** `mine`: diarios de sus grupos; `review`: bandeja de coordinación. Por defecto `mine`. */
  scope?: JournalScope;
  status?: JournalStatus;
  gradeId?: string;
  groupId?: string;
  from?: string;
  to?: string;
  /** Coordinadora del grado del grupo (UUID) o `none` (sin coordinadora); un docente lo ignora. */
  coordinatorId?: string;
}
