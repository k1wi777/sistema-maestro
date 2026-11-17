'use client';

import { AreaType } from '@gns/shared';
import { useState } from 'react';

import { Button, Checkbox, Dialog, Notice, Select, TextInput } from '@/shared/ui';

import { createArea, updateArea } from '../api/structure';
import type { StructureArea } from '../model/structure';
import { errorText } from './confirm-remove-dialog';
import styles from './grados-areas.module.css';

interface LevelOption {
  id: string;
  name: string;
}

export const AREA_TYPE_LABEL: Record<AreaType, string> = {
  [AreaType.Dimension]: 'Dimensión',
  [AreaType.Subject]: 'Asignatura',
};

/** Alta (`area` nulo y `open`) o edición de un área: nombre, tipo, niveles y activa. */
export function AreaDialog({
  open,
  area,
  levels,
  onDone,
  onClose,
}: {
  open: boolean;
  area: StructureArea | null;
  levels: LevelOption[];
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      wide
      title={area ? `Editar ${area.name}` : 'Nueva área'}
      description="El área se ofrece al asignar y al planear solo en los niveles que marques."
      onClose={onClose}
    >
      {open ? (
        <AreaForm
          key={area?.id ?? 'new'}
          area={area}
          levels={levels}
          onDone={onDone}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function AreaForm({
  area,
  levels,
  onDone,
  onClose,
}: {
  area: StructureArea | null;
  levels: LevelOption[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(area?.name ?? '');
  const [type, setType] = useState<AreaType>(area?.type ?? AreaType.Subject);
  const [levelIds, setLevelIds] = useState<string[]>(area?.levelIds ?? []);
  const [active, setActive] = useState(area?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const body = { name: name.trim(), type, levelIds };
    const result = area ? await updateArea(area.id, { ...body, active }) : await createArea(body);
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
        label="Nombre del área"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Select
        label="Tipo"
        value={type}
        options={Object.values(AreaType).map((value) => ({
          value,
          label: AREA_TYPE_LABEL[value],
        }))}
        onChange={(event) => setType(event.target.value as AreaType)}
      />
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Niveles</legend>
        <div className={styles.checks}>
          {levels.map((level) => (
            <Checkbox
              key={level.id}
              label={level.name}
              checked={levelIds.includes(level.id)}
              onChange={(event) =>
                setLevelIds((current) =>
                  event.target.checked
                    ? [...current, level.id]
                    : current.filter((id) => id !== level.id),
                )
              }
            />
          ))}
        </div>
      </fieldset>
      {area ? (
        <Checkbox
          label="Activa"
          help="Un área inactiva deja de ofrecerse en altas nuevas; lo registrado se conserva."
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
      ) : null}
      {error ? (
        <Notice tone="error" title="No se pudo guardar">
          {error}
        </Notice>
      ) : null}
      <div className={styles.footer}>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || name.trim() === '' || levelIds.length === 0}>
          {busy ? 'Guardando…' : 'Guardar área'}
        </Button>
      </div>
    </form>
  );
}
