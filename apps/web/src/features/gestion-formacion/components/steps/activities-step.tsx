'use client';

import { TrainingActivityStatus, type Activity } from '@gns/shared';
import { useMemo, useState } from 'react';

import type { ApiResult } from '@/shared/api';
import { Button, Card, Checkbox, Notice, StatusBadge } from '@/shared/ui';

import {
  restoreActivity,
  setActivityOrder,
  updateActivityRequired,
  withdrawActivity,
} from '../../api/modules';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL } from '../../model/labels';
import { ModuleActionDialog } from '../module-action-dialog';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

function replaceActivity(activities: Activity[], saved: Activity): Activity[] {
  return activities.map((activity) => (activity.id === saved.id ? saved : activity));
}

/**
 * Paso «Actividades»: gestiona las que ya existen (obligatoria u opcional, orden, quitar del módulo
 * y restaurar). El progreso de los docentes se conserva al quitar una actividad.
 */
export function ActivitiesStep({ editor, number }: StepProps) {
  const { detail, track, updateDetail } = editor;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<Activity | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const activities = useMemo(
    () => [...detail.activities].sort((a, b) => a.sortOrder - b.sortOrder),
    [detail.activities],
  );

  async function act<T>(id: string, call: () => Promise<ApiResult<T>>, apply: (data: T) => void) {
    setPendingId(id);
    setFailure(null);
    const result = await track(call);
    if (result.ok) {
      apply(result.data);
    } else {
      setFailure(result.error.message);
    }
    setPendingId(null);
  }

  function toggleRequired(activity: Activity, isRequired: boolean) {
    void act(
      activity.id,
      () => updateActivityRequired(detail.id, activity.id, isRequired),
      (saved: Activity) =>
        updateDetail((current) => ({
          ...current,
          activities: replaceActivity(current.activities, saved),
        })),
    );
  }

  function move(activity: Activity, offset: -1 | 1) {
    const ids = activities.map((item) => item.id);
    const from = ids.indexOf(activity.id);
    const to = from + offset;
    if (to < 0 || to >= ids.length) {
      return;
    }
    ids.splice(to, 0, ...ids.splice(from, 1));
    void act(
      activity.id,
      () => setActivityOrder(detail.id, ids),
      (saved: { activities: Activity[] }) =>
        updateDetail((current) => ({ ...current, activities: saved.activities })),
    );
  }

  function restore(activity: Activity) {
    void act(
      activity.id,
      () => restoreActivity(detail.id, activity.id),
      (saved: Activity) =>
        updateDetail((current) => ({
          ...current,
          activities: replaceActivity(current.activities, saved),
        })),
    );
  }

  async function confirmWithdraw() {
    if (!withdrawing) {
      return;
    }
    const target = withdrawing;
    await act(
      target.id,
      () => withdrawActivity(detail.id, target.id),
      (saved: Activity) =>
        updateDetail((current) => ({
          ...current,
          activities: replaceActivity(current.activities, saved),
        })),
    );
    setWithdrawing(null);
  }

  return (
    <Card title="Actividades" step={number}>
      <p className={styles.text}>
        Las obligatorias hacen falta para terminar el módulo; las opcionales no bloquean el
        certificado. Quitar una actividad no borra el progreso de los docentes: si la restauras, lo
        recuperan.
      </p>
      <Notice tone="info">
        Crear y configurar actividades nuevas (ruleta y pasaporte, Conecta, ¿Verdad o mito? y
        simulador) llegará en una próxima actualización. Aquí puedes gestionar las que ya existen.
      </Notice>
      {failure ? (
        <div className={styles.spaced}>
          <Notice tone="error" title="No se pudo completar la acción">
            {failure}
          </Notice>
        </div>
      ) : null}
      {activities.length === 0 ? (
        <p className={`${styles.text} ${styles.spaced}`}>
          Este módulo todavía no tiene actividades.
        </p>
      ) : (
        <ol className={`${styles.items} ${styles.spaced}`}>
          {activities.map((activity, index) => {
            const out = activity.status === TrainingActivityStatus.OutOfPlan;
            const busy = pendingId === activity.id || editor.busy;
            return (
              <li
                key={activity.id}
                className={`${styles.activity} ${out ? styles.activityOut : ''}`}
              >
                <div className={styles.activityMain}>
                  <span className={styles.activityTitle}>{activity.title}</span>
                  <span className={styles.activityMeta}>
                    <span>{ACTIVITY_TYPE_LABEL[activity.type]}</span>
                    <StatusBadge tone={out ? 'neutral' : 'success'}>
                      {ACTIVITY_STATUS_LABEL[activity.status]}
                    </StatusBadge>
                  </span>
                  <Checkbox
                    label="Obligatoria"
                    checked={activity.isRequired}
                    disabled={busy}
                    onChange={(event) => toggleRequired(activity, event.target.checked)}
                  />
                </div>
                <div className={styles.activityActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon="arriba"
                    disabled={busy || index === 0}
                    onClick={() => move(activity, -1)}
                  >
                    Subir
                    <span className="sr-only">{`: ${activity.title}`}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon="abajo"
                    disabled={busy || index === activities.length - 1}
                    onClick={() => move(activity, 1)}
                  >
                    Bajar
                    <span className="sr-only">{`: ${activity.title}`}</span>
                  </Button>
                  {out ? (
                    <Button size="sm" disabled={busy} onClick={() => restore(activity)}>
                      Restaurar
                      <span className="sr-only">{`: ${activity.title}`}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setWithdrawing(activity)}
                    >
                      Quitar del módulo
                      <span className="sr-only">{`: ${activity.title}`}</span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {withdrawing ? (
        <ModuleActionDialog
          confirmation={{
            title: `¿Quitar «${withdrawing.title}» del módulo?`,
            description:
              'La actividad deja de verse en el módulo de los docentes. Su progreso se conserva y puedes restaurarla cuando quieras.',
            confirmLabel: 'Quitar del módulo',
          }}
          busy={pendingId === withdrawing.id}
          onClose={() => setWithdrawing(null)}
          onConfirm={() => void confirmWithdraw()}
        />
      ) : null}
    </Card>
  );
}
