'use client';

import type { AcademicStructure } from '@gns/shared';
import { useState } from 'react';

import { Button, Checkbox, Dialog, Notice } from '@/shared/ui';

import { setCoordinatorGrades } from '../api/structure';
import type { StructureCoordinator } from '../model/structure';
import { errorText } from './confirm-remove-dialog';
import styles from './grados-areas.module.css';

/** Grados de una coordinadora: casillas por nivel; un grado de otra coordinadora dice «Ahora: …». */
export function CoordinatorDialog({
  coordinator,
  levels,
  onDone,
  onClose,
}: {
  coordinator: StructureCoordinator | null;
  levels: AcademicStructure['levels'];
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={coordinator !== null}
      wide
      title={coordinator ? `Grados de ${coordinator.fullName}` : 'Grados de la coordinadora'}
      description="Cada grado tiene a lo sumo una coordinadora: marcar uno de otra se lo quita a ella."
      onClose={onClose}
    >
      {coordinator ? (
        <CoordinatorForm
          key={coordinator.id}
          coordinator={coordinator}
          levels={levels}
          onDone={onDone}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function CoordinatorForm({
  coordinator,
  levels,
  onDone,
  onClose,
}: {
  coordinator: StructureCoordinator;
  levels: AcademicStructure['levels'];
  onDone: () => void;
  onClose: () => void;
}) {
  const [gradeIds, setGradeIds] = useState<string[]>(coordinator.gradeIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await setCoordinatorGrades(coordinator.id, gradeIds);
    setBusy(false);
    if (result.ok) {
      onDone();
    } else {
      setError(errorText(result.error));
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {levels
        .filter((level) => level.grades.some((grade) => grade.active))
        .map((level) => (
          <fieldset key={level.id} className={styles.fieldset}>
            <legend className={styles.legend}>{level.name}</legend>
            <div className={styles.checks}>
              {level.grades
                .filter((grade) => grade.active)
                .map((grade) => (
                  <Checkbox
                    key={grade.id}
                    label={grade.name}
                    help={
                      grade.coordinator && grade.coordinator.id !== coordinator.id
                        ? `Ahora: ${grade.coordinator.fullName}`
                        : undefined
                    }
                    checked={gradeIds.includes(grade.id)}
                    onChange={(event) =>
                      setGradeIds((current) =>
                        event.target.checked
                          ? [...current, grade.id]
                          : current.filter((id) => id !== grade.id),
                      )
                    }
                  />
                ))}
            </div>
          </fieldset>
        ))}
      {error ? (
        <Notice tone="error" title="No se pudo guardar">
          {error}
        </Notice>
      ) : null}
      <div className={styles.footer}>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar grados'}
        </Button>
      </div>
    </form>
  );
}
