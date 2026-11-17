'use client';

import { useState } from 'react';

import { Button, Checkbox, Dialog, Notice, Select, StatusBadge, TextInput } from '@/shared/ui';

import { createGrade, createGroup, deleteGroup, updateGrade, updateGroup } from '../api/structure';
import { nextGroupName, parseGradeOrder, type StructureGrade } from '../model/structure';
import { errorText, type RemoveTarget } from './confirm-remove-dialog';
import styles from './grados-areas.module.css';

interface LevelOption {
  id: string;
  name: string;
}

/** Nuevo grupo de un grado, con el nombre propuesto `<grado> <n+1>`. */
export function AddGroupDialog({
  grade,
  onDone,
  onClose,
}: {
  grade: StructureGrade | null;
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={grade !== null}
      title={grade ? `Agregar grupo a ${grade.name}` : 'Agregar grupo'}
      onClose={onClose}
    >
      {grade ? (
        <AddGroupForm key={grade.id} grade={grade} onDone={onDone} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function AddGroupForm({
  grade,
  onDone,
  onClose,
}: {
  grade: StructureGrade;
  onDone: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(() => nextGroupName(grade));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await createGroup(grade.id, name.trim());
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
      <TextInput
        label="Nombre del grupo"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {error ? (
        <Notice tone="error" title="No se pudo guardar">
          {error}
        </Notice>
      ) : null}
      <div className={styles.footer}>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || name.trim() === ''}>
          {busy ? 'Guardando…' : 'Guardar grupo'}
        </Button>
      </div>
    </form>
  );
}

/** Edición de un grado: nombre, nivel (fijo si está en uso), activo y sus grupos. */
export function GradeDialog({
  target,
  levels,
  onChanged,
  onAddGroup,
  onRemove,
  onClose,
}: {
  /** El grado y el id de su nivel (la estructura los anida por nivel). */
  target: { grade: StructureGrade; levelId: string } | null;
  levels: LevelOption[];
  /** Vuelve a pedir la estructura; el diálogo se actualiza con ella. */
  onChanged: () => Promise<unknown>;
  onAddGroup: (grade: StructureGrade) => void;
  onRemove: (target: RemoveTarget) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      wide
      title={target ? `Editar ${target.grade.name}` : 'Editar grado'}
      description="Los grupos en uso no se borran: se desactivan y lo registrado se conserva."
      onClose={onClose}
    >
      {target ? (
        <GradeForm
          key={target.grade.id}
          grade={target.grade}
          levelId={target.levelId}
          levels={levels}
          onChanged={onChanged}
          onAddGroup={onAddGroup}
          onRemove={onRemove}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function GradeForm({
  grade,
  levelId: initialLevelId,
  levels,
  onChanged,
  onAddGroup,
  onRemove,
  onClose,
}: {
  grade: StructureGrade;
  levelId: string;
  levels: LevelOption[];
  onChanged: () => Promise<unknown>;
  onAddGroup: (grade: StructureGrade) => void;
  onRemove: (target: RemoveTarget) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(grade.name);
  const [levelId, setLevelId] = useState(initialLevelId);
  const [order, setOrder] = useState(String(grade.sortOrder));
  const [active, setActive] = useState(grade.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const sortOrder = parseGradeOrder(order);
    if (sortOrder === null) {
      setError('El orden debe ser un entero de 1 a 32767.');
      setBusy(false);
      return;
    }
    const result = await updateGrade(grade.id, {
      name: name.trim(),
      sortOrder,
      ...(grade.inUse ? {} : { levelId }),
      active,
    });
    if (result.ok) {
      await onChanged();
      onClose();
    } else {
      setError(errorText(result.error));
    }
    setBusy(false);
  }

  async function toggleGroup(id: string, next: boolean) {
    setBusy(true);
    setError(null);
    const result = await updateGroup(id, { active: next });
    if (result.ok) {
      await onChanged();
    } else {
      setError(errorText(result.error));
    }
    setBusy(false);
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextInput
        label="Nombre del grado"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Select
        label="Nivel"
        value={levelId}
        disabled={grade.inUse}
        help={grade.inUse ? 'El grado tiene registros: no se puede cambiar de nivel.' : undefined}
        options={levels.map((level) => ({ value: level.id, label: level.name }))}
        onChange={(event) => setLevelId(event.target.value)}
      />
      <TextInput
        label="Orden"
        required
        inputMode="numeric"
        help="Ubica el grado entre los demás de la lista."
        value={order}
        onChange={(event) => setOrder(event.target.value)}
      />
      <Checkbox
        label="Activo"
        help="Un grado inactivo deja de ofrecerse en altas nuevas; lo registrado se conserva."
        checked={active}
        onChange={(event) => setActive(event.target.checked)}
      />
      <section aria-labelledby={`groups-${grade.id}`}>
        <h3 id={`groups-${grade.id}`} className={styles.subheading}>
          Grupos
        </h3>
        {grade.groups.length === 0 ? (
          <p className={styles.muted}>Sin grupos</p>
        ) : (
          <ul className={styles.list}>
            {grade.groups.map((group) => (
              <li key={group.id} className={styles.listRow}>
                <span>
                  {group.name}
                  {!group.active ? <StatusBadge tone="neutral">Inactivo</StatusBadge> : null}
                </span>
                <span className={styles.rowActions}>
                  {group.inUse ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      context={`el grupo ${group.name}`}
                      onClick={() =>
                        group.active
                          ? onRemove({
                              what: `el grupo ${group.name}`,
                              inUse: true,
                              run: async () => {
                                const result = await updateGroup(group.id, { active: false });
                                if (result.ok) {
                                  await onChanged();
                                }
                                return result;
                              },
                            })
                          : void toggleGroup(group.id, true)
                      }
                    >
                      {group.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      context={`el grupo ${group.name}`}
                      onClick={() =>
                        onRemove({
                          what: `el grupo ${group.name}`,
                          inUse: false,
                          run: async () => {
                            const result = await deleteGroup(group.id);
                            if (result.ok) {
                              await onChanged();
                            }
                            return result;
                          },
                        })
                      }
                    >
                      Quitar
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onAddGroup(grade)}>
          Agregar grupo
        </Button>
      </section>
      {error ? (
        <Notice tone="error" title="No se pudo guardar">
          {error}
        </Notice>
      ) : null}
      <div className={styles.footer}>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || name.trim() === ''}>
          {busy ? 'Guardando…' : 'Guardar grado'}
        </Button>
      </div>
    </form>
  );
}

/** Nuevo grado: nivel, nombre y orden (propuesto después del último). */
export function NewGradeDialog({
  open,
  levels,
  defaultOrder,
  onDone,
  onClose,
}: {
  open: boolean;
  levels: LevelOption[];
  defaultOrder: number;
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title="Nuevo grado"
      description="Después de crearlo, agrégale al menos un grupo para poder asignar docentes."
      onClose={onClose}
    >
      {open ? (
        <NewGradeForm
          levels={levels}
          defaultOrder={defaultOrder}
          onDone={onDone}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function NewGradeForm({
  levels,
  defaultOrder,
  onDone,
  onClose,
}: {
  levels: LevelOption[];
  defaultOrder: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const [levelId, setLevelId] = useState(levels[0]?.id ?? '');
  const [name, setName] = useState('');
  const [order, setOrder] = useState(String(defaultOrder));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const sortOrder = parseGradeOrder(order);
    if (sortOrder === null) {
      setError('El orden debe ser un entero de 1 a 32767.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createGrade({ name: name.trim(), levelId, sortOrder });
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
      <Select
        label="Nivel"
        required
        value={levelId}
        options={levels.map((level) => ({ value: level.id, label: level.name }))}
        onChange={(event) => setLevelId(event.target.value)}
      />
      <TextInput
        label="Nombre del grado"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextInput
        label="Orden"
        required
        inputMode="numeric"
        help="Ubica el grado entre los demás de la lista."
        value={order}
        onChange={(event) => setOrder(event.target.value)}
      />
      {error ? (
        <Notice tone="error" title="No se pudo guardar">
          {error}
        </Notice>
      ) : null}
      <div className={styles.footer}>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || name.trim() === '' || levelId === ''}>
          {busy ? 'Guardando…' : 'Guardar grado'}
        </Button>
      </div>
    </form>
  );
}
