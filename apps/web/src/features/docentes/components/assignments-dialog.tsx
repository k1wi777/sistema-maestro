'use client';

import { AreaType, TeacherAssignmentStatus, UserStatus } from '@gns/shared';
import { useMemo, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { Button, Checkbox, Dialog, Notice, Select, StatusBadge } from '@/shared/ui';

import {
  createAssignment,
  setAssignmentStatus,
  setHomeroom,
  type CatalogArea,
  type CatalogGrade,
  type CatalogGroup,
  type CatalogLevel,
} from '../api/assignments';
import { homeroomTargets, planAssignments, planHomeroom } from '../model/assignment-plan';
import { areasForLevel, editableGroupIds, groupOptions } from '../model/group-options';
import type { RosterTeacher } from '../model/roster';
import styles from './assignments-dialog.module.css';

interface AssignmentsDialogProps {
  teacher: RosterTeacher | null;
  grades: CatalogGrade[];
  groups: CatalogGroup[];
  levels: CatalogLevel[];
  areas: CatalogArea[];
  /** No hay año lectivo vigente: no se puede asignar. */
  noYear: boolean;
  /** Grados en los que se puede asignar (coordinación: los suyos); `null`, todos (administración). */
  allowedGradeIds: ReadonlySet<string> | null;
  /** Texto de ayuda cuando el alcance está restringido. */
  scopeHint?: string;
  /** Vuelve a pedir los datos de la pantalla sin perder el diálogo. */
  onChanged: () => Promise<ApiError | null>;
  onClose: () => void;
}

interface Report {
  saved: string[];
  skipped: string[];
  failed: { area: string; message: string }[];
}

const AREA_GROUPS: { type: AreaType; label: string }[] = [
  { type: AreaType.Subject, label: 'Asignaturas' },
  { type: AreaType.Dimension, label: 'Dimensiones' },
];

function Body({
  teacher,
  grades,
  groups,
  levels,
  areas,
  noYear,
  allowedGradeIds,
  scopeHint,
  onChanged,
}: Omit<AssignmentsDialogProps, 'teacher' | 'onClose'> & { teacher: RosterTeacher }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [groupId, setGroupId] = useState('');
  const [homeroom, setHomeroomChoice] = useState(false);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);

  const inactive = teacher.status === UserStatus.Inactive;
  const readOnly = inactive || noYear;

  const editable = useMemo(
    () => editableGroupIds(groups, allowedGradeIds),
    [groups, allowedGradeIds],
  );
  const options = useMemo(
    () => groupOptions(groups, grades, levels).filter((option) => editable.has(option.id)),
    [groups, grades, levels, editable],
  );
  const chosen = options.find((option) => option.id === groupId);
  const levelAreas = chosen ? areasForLevel(areas, chosen.levelId) : [];
  const activeAreaIds = new Set(
    teacher.assignments
      .filter((item) => item.group.id === groupId && item.status === TeacherAssignmentStatus.Active)
      .map((item) => item.area.id),
  );

  async function refresh() {
    const failure = await onChanged();
    if (failure) {
      setError(failure.message);
    }
  }

  async function retire(assignmentId: string) {
    setBusy(true);
    setError(null);
    const result = await setAssignmentStatus(assignmentId, TeacherAssignmentStatus.Withdrawn);
    if (!result.ok) {
      setError(result.error.message);
    } else {
      setConfirming(null);
      await refresh();
    }
    setBusy(false);
  }

  async function toggleHomeroom(targetGroupId: string, on: boolean) {
    setBusy(true);
    setError(null);
    for (const id of homeroomTargets(teacher.assignments, targetGroupId, on)) {
      const result = await setHomeroom(id, on);
      if (!result.ok) {
        setError(result.error.message);
        break;
      }
    }
    await refresh();
    setBusy(false);
  }

  async function assign() {
    const picked = levelAreas.filter((area) => areaIds.includes(area.id));
    const steps = planAssignments(teacher.assignments, groupId, picked);
    const mark = homeroom
      ? planHomeroom(steps, teacher.assignments, groupId)
      : { onCreateAreaId: null, afterAssignmentId: null };
    setBusy(true);
    setError(null);
    const next: Report = { saved: [], skipped: [], failed: [] };
    // En serie: la API valida cada asignación y un fallo no debe impedir informar las demás.
    for (const step of steps) {
      if (step.kind === 'skip') {
        next.skipped.push(step.areaName);
        continue;
      }
      const result =
        step.kind === 'create'
          ? await createAssignment({
              teacherId: teacher.id,
              groupId,
              areaId: step.areaId,
              isHomeroomTeacher: mark.onCreateAreaId === step.areaId,
            })
          : await setAssignmentStatus(step.assignmentId, TeacherAssignmentStatus.Active);
      if (result.ok) {
        next.saved.push(step.areaName);
      } else {
        next.failed.push({ area: step.areaName, message: result.error.message });
      }
    }
    // La marca de director(a) sobre una asignación que ya existía o se reactivó: la API valida que el
    // grupo no tenga otro (409) y el mensaje se muestra tal cual.
    if (mark.afterAssignmentId && next.failed.length === 0) {
      const marked = await setHomeroom(mark.afterAssignmentId, true);
      if (!marked.ok) {
        setError(marked.error.message);
      }
    }
    setReport(next);
    setAreaIds(
      next.failed.length > 0
        ? picked
            .filter((area) => next.failed.some((item) => item.area === area.name))
            .map((area) => area.id)
        : [],
    );
    await refresh();
    setBusy(false);
  }

  return (
    <>
      {inactive ? (
        <Notice tone="warning" title="Docente inactivo">
          Esta cuenta está desactivada: sus asignaciones se muestran solo para consulta.
        </Notice>
      ) : null}
      {noYear ? (
        <Notice tone="warning" title="Sin año lectivo vigente">
          Administración debe definir el año lectivo vigente para poder asignar grados y áreas.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="error" title="No se pudo guardar">
          {error}
        </Notice>
      ) : null}

      <section aria-labelledby="active-assignments">
        <h3 id="active-assignments" className={styles.heading}>
          Asignaciones activas
        </h3>
        {teacher.groups.length === 0 ? (
          <p className={styles.muted}>Aún no tiene asignaciones activas en el año vigente.</p>
        ) : (
          <ul className={styles.grades}>
            {teacher.groups.map((group) => (
              <li key={group.id} className={styles.grade}>
                <div className={styles.gradeHead}>
                  <strong>{group.name}</strong>
                  {!editable.has(group.id) ? (
                    <StatusBadge tone="neutral">Solo consulta</StatusBadge>
                  ) : null}
                  {!readOnly && editable.has(group.id) ? (
                    <Checkbox
                      label={`Director(a) de ${group.name}`}
                      checked={group.isHomeroom}
                      disabled={busy}
                      onChange={(event) => void toggleHomeroom(group.id, event.target.checked)}
                    />
                  ) : group.isHomeroom ? (
                    <span className={styles.muted}>{`Director(a) de ${group.name}`}</span>
                  ) : null}
                </div>
                <ul className={styles.areas}>
                  {group.areas.map((area) => (
                    <li key={area.assignmentId} className={styles.area}>
                      <span>{area.name}</span>
                      {readOnly || !editable.has(group.id) ? null : confirming ===
                        area.assignmentId ? (
                        <span className={styles.confirm}>
                          <span>{`¿Retirar ${area.name} de ${group.name}?`}</span>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={() => void retire(area.assignmentId)}
                          >
                            {busy ? 'Retirando…' : 'Sí, retirar'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirming(null)}
                          >
                            Cancelar
                          </Button>
                        </span>
                      ) : (
                        <Button
                          context={`la asignación de ${area.name} en ${group.name}`}
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirming(area.assignmentId)}
                        >
                          Retirar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {teacher.withdrawnCount > 0 ? (
          <p className={styles.muted}>
            {teacher.withdrawnCount === 1
              ? '1 asignación retirada: se reactiva al volver a asignar esa área.'
              : `${teacher.withdrawnCount} asignaciones retiradas: se reactivan al volver a asignar esas áreas.`}
          </p>
        ) : null}
      </section>

      {readOnly ? null : (
        <section aria-labelledby="assign-grade" className={styles.assign}>
          <h3 id="assign-grade" className={styles.heading}>
            Asignar al grupo
          </h3>
          {scopeHint ? <p className={styles.muted}>{scopeHint}</p> : null}
          <Select
            label="Grupo"
            placeholder="Selecciona un grupo"
            value={groupId}
            disabled={busy}
            options={options.map((option) => ({ value: option.id, label: option.label }))}
            onChange={(event) => {
              setGroupId(event.target.value);
              setAreaIds([]);
              setHomeroomChoice(false);
              setReport(null);
            }}
          />
          {groupId ? (
            <Checkbox
              label="Director(a) de este grupo"
              checked={homeroom}
              disabled={busy}
              onChange={(event) => setHomeroomChoice(event.target.checked)}
            />
          ) : null}
          {groupId
            ? AREA_GROUPS.map((kind) => {
                const typed = levelAreas.filter((area) => area.type === kind.type);
                return typed.length === 0 ? null : (
                  <fieldset key={kind.type} className={styles.fieldset}>
                    <legend className={styles.legend}>{kind.label}</legend>
                    <div className={styles.checks}>
                      {typed.map((area) => (
                        <Checkbox
                          key={area.id}
                          label={area.name}
                          help={activeAreaIds.has(area.id) ? 'Ya asignada' : undefined}
                          checked={activeAreaIds.has(area.id) || areaIds.includes(area.id)}
                          disabled={busy || activeAreaIds.has(area.id)}
                          onChange={(event) =>
                            setAreaIds((current) =>
                              event.target.checked
                                ? [...current, area.id]
                                : current.filter((id) => id !== area.id),
                            )
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })
            : null}
          <div>
            <Button
              disabled={busy || !groupId || areaIds.length === 0}
              onClick={() => void assign()}
            >
              {busy ? 'Asignando…' : 'Asignar al grupo'}
            </Button>
          </div>
          {report ? (
            <div className={styles.report} role="status">
              {report.saved.length > 0 ? (
                <Notice tone="success" title="Asignadas">
                  {report.saved.join(', ')}
                </Notice>
              ) : null}
              {report.skipped.length > 0 ? (
                <Notice tone="info" title="Ya estaban asignadas">
                  {report.skipped.join(', ')}
                </Notice>
              ) : null}
              {report.failed.map((item) => (
                <Notice key={item.area} tone="error" title={`No se asignó ${item.area}`}>
                  {item.message}
                </Notice>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}

/** Asignaciones de un docente en el año vigente: retirar, dirección de grupo y asignar áreas. */
export function AssignmentsDialog({ teacher, onClose, ...rest }: AssignmentsDialogProps) {
  return (
    <Dialog
      open={teacher !== null}
      wide
      title={teacher ? `Asignaciones de ${teacher.name}` : 'Asignaciones'}
      description="Grupos y áreas del año lectivo vigente. Retirar una asignación no la borra."
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {teacher ? <Body key={teacher.id} teacher={teacher} {...rest} /> : null}
    </Dialog>
  );
}
