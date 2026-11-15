'use client';

import {
  LESSON_PLAN_TOPIC_MAX_LENGTH,
  createLessonPlanSchema,
  crossCuttingProjectFor,
  type SharedActivity,
} from '@gns/shared';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { ApiError } from '@/shared/api';
import {
  ActionBar,
  Button,
  ButtonLink,
  Card,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  TextInput,
  type SelectOption,
} from '@/shared/ui';

import { addLessonPlanResource, createLessonPlan } from '../api/lesson-plans';
import { getSharedActivity } from '../api/shared-activities';
import { useRemote } from '../hooks/use-remote';
import {
  NO_SCHOOL_YEAR_STATUS,
  useTeachingContext,
  type TeachingContext,
} from '../hooks/use-teaching-context';
import { activityLinkResource, activityToPlanContent } from '../model/activity-mapping';
import { dateRangeError, mapApiErrors, type FormErrors } from '../model/form-state';
import { LoadError, Loading } from './load-error';
import styles from './new-lesson-plan.module.css';

interface NewPlanValues {
  assignment: string;
  periodId: string;
  dateFrom: string;
  dateTo: string;
  topic: string;
}

type NewPlanErrors = Partial<Record<keyof NewPlanValues, string>>;

interface AssignmentEntry {
  value: string;
  label: string;
  gradeId: string;
  areaId: string;
  levelId: string;
  levelName: string;
}

function assignmentEntries(context: TeachingContext): AssignmentEntry[] {
  return [...context.grades]
    .sort((a, b) => a.grade.sortOrder - b.grade.sortOrder)
    .flatMap((entry) =>
      entry.areas.map((area) => ({
        value: `${entry.grade.id}:${area.id}`,
        label: `${entry.grade.name} · ${area.name}`,
        gradeId: entry.grade.id,
        areaId: area.id,
        levelId: entry.level.id,
        levelName: entry.level.name,
      })),
    );
}

/**
 * Asignación que se preselecciona al partir de una actividad: la de su grado y área o, si la
 * actividad es de todo el nivel, la única asignación con ese nivel y área.
 */
function defaultAssignment(entries: AssignmentEntry[], activity: SharedActivity | null): string {
  if (!activity?.area) {
    return '';
  }
  const areaId = activity.area.id;
  const matches = activity.grade
    ? entries.filter((entry) => entry.gradeId === activity.grade?.id && entry.areaId === areaId)
    : entries.filter((entry) => entry.levelId === activity.level?.id && entry.areaId === areaId);
  return matches.length === 1 ? (matches[0]?.value ?? '') : '';
}

function fieldErrorsOf(errors: FormErrors): NewPlanErrors {
  return {
    periodId: errors.periodId,
    dateFrom: errors.dateFrom,
    dateTo: errors.dateTo,
    topic: errors.topic,
  };
}

function ContextProblem({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.statusCode === NO_SCHOOL_YEAR_STATUS) {
    return (
      <Notice tone="warning" title="No hay un año lectivo vigente">
        Todavía no se puede crear una planeación porque la administración no ha definido el año
        lectivo. Inténtalo cuando esté disponible.
      </Notice>
    );
  }
  return <LoadError error={error} onRetry={onRetry} />;
}

function NewLessonPlanForm({
  context,
  activity,
}: {
  context: TeachingContext;
  activity: SharedActivity | null;
}) {
  const router = useRouter();
  const entries = useMemo(() => assignmentEntries(context), [context]);
  const [overrides, setOverrides] = useState<Partial<NewPlanValues>>({});
  const [errors, setErrors] = useState<NewPlanErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preselected = defaultAssignment(entries, activity);
  const entry = (overrides.assignment ?? preselected) || undefined;
  const selected = entries.find((candidate) => candidate.value === entry);
  const mapped = activity ? activityToPlanContent(activity, selected?.levelName ?? '') : null;
  const values: NewPlanValues = {
    assignment: selected?.value ?? '',
    periodId: overrides.periodId ?? '',
    dateFrom: overrides.dateFrom ?? '',
    dateTo: overrides.dateTo ?? '',
    topic: overrides.topic ?? mapped?.content.topic ?? '',
  };

  const period = context.periods.find((candidate) => candidate.id === values.periodId);
  const project =
    selected && period ? crossCuttingProjectFor(selected.levelName, period.number) : null;
  const periodOptions: SelectOption[] = context.periods.map((candidate) => ({
    value: candidate.id,
    label: `Periodo ${candidate.number}`,
  }));
  const rangeError = dateRangeError(values);

  function change(patch: Partial<NewPlanValues>) {
    setOverrides((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch) as (keyof NewPlanValues)[]) {
        delete next[key];
      }
      return next;
    });
  }

  async function handleSubmit() {
    const found: NewPlanErrors = {};
    if (!selected) {
      found.assignment = 'Elige el grado y el área.';
    }
    if (!period) {
      found.periodId = 'Elige el periodo.';
    }
    if (rangeError) {
      found.dateTo = rangeError;
    }
    const parsed = createLessonPlanSchema.safeParse({
      ...mapped?.content,
      gradeId: selected?.gradeId ?? '',
      areaId: selected?.areaId ?? '',
      periodId: period?.id ?? '',
      dateFrom: values.dateFrom || null,
      dateTo: values.dateTo || null,
      // El tema del formulario manda: el docente pudo cambiar el que venía de la actividad.
      topic: values.topic,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (
          field === 'periodId' ||
          field === 'dateFrom' ||
          field === 'dateTo' ||
          field === 'topic'
        ) {
          found[field] ??= issue.message;
        }
      }
    }
    if (Object.keys(found).length > 0 || !parsed.success || !selected) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setFormError(null);
    const result = await createLessonPlan(parsed.data);
    if (!result.ok) {
      setSaving(false);
      const apiErrors = mapApiErrors(
        result.error.statusCode === 400 ? result.error.errors : undefined,
      );
      setErrors(fieldErrorsOf(apiErrors.fields));
      setFormError(apiErrors.other[0] ?? result.error.message);
      return;
    }

    const planId = result.data.id;
    const link = activity ? activityLinkResource(activity) : null;
    if (link) {
      const added = await addLessonPlanResource(planId, link);
      if (!added.ok) {
        // La planeación ya existe: se abre el editor y se avisa para que agregue el enlace a mano.
        router.replace(
          `/docente/planeacion/${planId}?paso=digitales&aviso=enlace&enlace=${encodeURIComponent(link.url)}`,
        );
        return;
      }
    }
    router.replace(`/docente/planeacion/${planId}?paso=desempeno`);
  }

  return (
    <>
      {activity ? (
        <Notice tone="info" title={`Crearás una planeación a partir de «${activity.title}»`}>
          El objetivo, el paso a paso y los materiales de la actividad quedan como punto de partida;
          podrás cambiarlos en el editor.
          {mapped && mapped.clipped.length > 0
            ? ' Algunos textos superaban el máximo permitido y se recortaron: revísalos.'
            : ''}
        </Notice>
      ) : null}
      <Card title="Datos generales">
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Select
            label="Grado y área"
            required
            placeholder="Selecciona el grado y el área"
            options={entries.map(({ value, label }) => ({ value, label }))}
            value={values.assignment}
            error={errors.assignment}
            onChange={(event) => change({ assignment: event.target.value })}
          />
          <Select
            label="Periodo"
            required
            placeholder="Selecciona el periodo"
            options={periodOptions}
            value={values.periodId}
            error={errors.periodId}
            onChange={(event) => change({ periodId: event.target.value })}
          />
          <TextInput
            label="Desde"
            type="date"
            value={values.dateFrom}
            error={errors.dateFrom}
            onChange={(event) => change({ dateFrom: event.target.value })}
          />
          <TextInput
            label="Hasta"
            type="date"
            value={values.dateTo}
            error={errors.dateTo ?? rangeError ?? undefined}
            onChange={(event) => change({ dateTo: event.target.value })}
          />
          <div className={styles.full}>
            <TextInput
              label="Proyecto o tema"
              maxLength={LESSON_PLAN_TOPIC_MAX_LENGTH}
              placeholder="Ej. Proyecto mensual «Mi cuerpo en movimiento»"
              value={values.topic}
              error={errors.topic}
              onChange={(event) => change({ topic: event.target.value })}
            />
          </div>
          {selected && period ? (
            <p className={styles.project}>
              {project
                ? `Proyecto transversal: ${project}`
                : 'Este nivel no tiene proyecto transversal en este periodo.'}
            </p>
          ) : null}
          {formError ? (
            <div className={styles.full}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}
        </form>
      </Card>
      <ActionBar
        className={styles.actionBar}
        status={
          Object.keys(errors).length > 0 ? 'Revisa los campos marcados.' : 'Aún no se ha creado'
        }
      >
        <ButtonLink href="/docente/planeacion" variant="outline">
          Cancelar
        </ButtonLink>
        <Button endIcon="siguiente" disabled={saving} onClick={() => void handleSubmit()}>
          {saving ? 'Creando…' : 'Crear y continuar'}
        </Button>
      </ActionBar>
    </>
  );
}

function NewLessonPlanBody({ activityId }: { activityId: string | null }) {
  const teaching = useTeachingContext();
  const activity = useRemote<SharedActivity | null>(
    async () => {
      if (!activityId) {
        return { ok: true, data: null };
      }
      return getSharedActivity(activityId);
    },
    `activity:${activityId ?? ''}`,
  );

  if (teaching.state.status === 'loading' || activity.state.status === 'loading') {
    return <Loading>Preparando el formulario…</Loading>;
  }
  if (teaching.state.status === 'error') {
    return <ContextProblem error={teaching.state.error} onRetry={teaching.reload} />;
  }
  if (activity.state.status === 'error') {
    return (
      <LoadError
        error={activity.state.error}
        title="No pudimos cargar la actividad"
        onRetry={activity.reload}
      />
    );
  }
  const context = teaching.state.data;
  if (context.grades.every((entry) => entry.areas.length === 0)) {
    return (
      <Notice tone="warning" title="Aún no tienes asignaciones activas">
        Coordinación debe asignarte grados y áreas para el año {context.schoolYear} antes de que
        puedas crear planeaciones.
      </Notice>
    );
  }
  return <NewLessonPlanForm context={context} activity={activity.state.data} />;
}

/** `/docente/planeacion/nueva`: datos generales para crear el borrador (con `?actividad=<id>` precargado). */
export function NewLessonPlan({ activityId }: { activityId: string | null }) {
  return (
    <PageContainer>
      <PageHeader
        context="Planeación GNS"
        title="Nueva planeación"
        description="Elige el grado, el área y el periodo. Después completarás la planeación paso a paso."
        actions={
          <ButtonLink href="/docente/planeacion" variant="outline" startIcon="volver">
            Mis planeaciones
          </ButtonLink>
        }
      />
      <div className={styles.stack}>
        <NewLessonPlanBody activityId={activityId} />
      </div>
    </PageContainer>
  );
}
