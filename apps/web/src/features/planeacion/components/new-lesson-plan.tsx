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
import { useRemote } from '@/shared/data';
import {
  NO_SCHOOL_YEAR_STATUS,
  useTeachingContext,
  type TeachingContext,
} from '../hooks/use-teaching-context';
import { activityLinkResource, activityToPlanContent } from '../model/activity-mapping';
import { dateRangeError, mapApiErrors, type FormErrors } from '../model/form-state';
import { LoadError, Loading } from '@/shared/data';
import styles from './new-lesson-plan.module.css';
import { PLANNING_PATH, planPath } from '../model/paths';
import { AreaChecklist } from './area-checklist';

interface NewPlanValues {
  gradeId: string;
  areaIds: string[];
  periodId: string;
  dateFrom: string;
  dateTo: string;
  topic: string;
}

type NewPlanErrors = Partial<Record<keyof NewPlanValues, string>>;

type GradeEntry = TeachingContext['grades'][number];

/**
 * Grado que se preselecciona al partir de una actividad: el suyo si el docente lo puede planear o,
 * si es de todo el nivel, el único grado del docente en ese nivel.
 */
function defaultGrade(grades: GradeEntry[], activity: SharedActivity | null): string {
  if (!activity) {
    return '';
  }
  if (activity.grade) {
    return grades.find((entry) => entry.grade.id === activity.grade?.id)?.grade.id ?? '';
  }
  const inLevel = grades.filter((entry) => entry.level.id === activity.level?.id);
  return inLevel.length === 1 ? (inLevel[0]?.grade.id ?? '') : '';
}

/** Áreas marcadas de entrada en un grado: la de la actividad si se ofrece o la única asignada. */
function defaultAreas(entry: GradeEntry | undefined, activity: SharedActivity | null): string[] {
  if (!entry) {
    return [];
  }
  const activityArea = activity?.area?.id;
  if (activityArea && entry.areas.some((area) => area.id === activityArea)) {
    return [activityArea];
  }
  const assigned = entry.areas.filter((area) => area.assigned);
  return assigned.length === 1 ? assigned.map((area) => area.id) : [];
}

function fieldErrorsOf(errors: FormErrors): NewPlanErrors {
  return {
    areaIds: errors.areaIds,
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
  const grades = useMemo(
    () => [...context.grades].sort((a, b) => a.grade.sortOrder - b.grade.sortOrder),
    [context],
  );
  const [overrides, setOverrides] = useState<Partial<NewPlanValues>>({});
  const [errors, setErrors] = useState<NewPlanErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gradeId = overrides.gradeId ?? defaultGrade(grades, activity);
  const selected = grades.find((candidate) => candidate.grade.id === gradeId);
  const mapped = activity ? activityToPlanContent(activity, selected?.level.name ?? '') : null;
  const values: NewPlanValues = {
    gradeId: selected?.grade.id ?? '',
    areaIds: overrides.areaIds ?? defaultAreas(selected, activity),
    periodId: overrides.periodId ?? '',
    dateFrom: overrides.dateFrom ?? '',
    dateTo: overrides.dateTo ?? '',
    topic: overrides.topic ?? mapped?.content.topic ?? '',
  };

  const period = context.periods.find((candidate) => candidate.id === values.periodId);
  const project =
    selected && period ? crossCuttingProjectFor(selected.level.name, period.number) : null;
  const periodOptions: SelectOption[] = context.periods.map((candidate) => ({
    value: candidate.id,
    label: `Periodo ${candidate.number}`,
  }));
  const rangeError = dateRangeError(values);

  function changeGrade(nextGradeId: string) {
    const next = grades.find((candidate) => candidate.grade.id === nextGradeId);
    // Al cambiar de grado se conservan solo las marcas que el nuevo grado también ofrece.
    const kept = values.areaIds.filter((id) => next?.areas.some((area) => area.id === id));
    change({
      gradeId: nextGradeId,
      areaIds: kept.length > 0 ? kept : defaultAreas(next, activity),
    });
  }

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
      found.gradeId = 'Elige el grado.';
    } else if (values.areaIds.length === 0) {
      found.areaIds = 'Elige al menos una dimensión o asignatura.';
    }
    if (!period) {
      found.periodId = 'Elige el periodo.';
    }
    if (rangeError) {
      found.dateTo = rangeError;
    }
    const parsed = createLessonPlanSchema.safeParse({
      ...mapped?.content,
      gradeId: selected?.grade.id ?? '',
      areaIds: values.areaIds,
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
          field === 'areaIds' ||
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
          `${planPath(planId)}?paso=digitales&aviso=enlace&enlace=${encodeURIComponent(link.url)}`,
        );
        return;
      }
    }
    router.replace(`${planPath(planId)}?paso=desempeno`);
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
            label="Grado"
            required
            placeholder="Selecciona el grado"
            options={grades.map((entry) => ({ value: entry.grade.id, label: entry.grade.name }))}
            value={values.gradeId}
            error={errors.gradeId}
            onChange={(event) => changeGrade(event.target.value)}
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
          {selected ? (
            <div className={styles.full}>
              <AreaChecklist
                areas={selected.areas}
                selected={values.areaIds}
                error={errors.areaIds}
                onChange={(areaIds) => change({ areaIds })}
              />
            </div>
          ) : null}
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
        <ButtonLink href={PLANNING_PATH} variant="outline">
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
  if (context.grades.length === 0) {
    return (
      <Notice tone="warning" title="Aún no tienes asignaciones activas">
        Coordinación debe asignarte grados y áreas para el año {context.schoolYear} antes de que
        puedas crear planeaciones.
      </Notice>
    );
  }
  return <NewLessonPlanForm context={context} activity={activity.state.data} />;
}

/** `/docente/formatos/planeacion/nueva`: datos generales para crear el borrador (con `?actividad=<id>` precargado). */
export function NewLessonPlan({ activityId }: { activityId: string | null }) {
  return (
    <PageContainer>
      <PageHeader
        context="Planeación GNS"
        title="Nueva planeación"
        description="Elige el grado, las dimensiones o asignaturas y el periodo. Después completarás la planeación paso a paso."
        actions={
          <ButtonLink href={PLANNING_PATH} variant="outline" startIcon="volver">
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
