'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { todayInColombia } from '@/shared/format/dates';
import { Button, Dialog, Select, TextInput } from '@/shared/ui';

import { journalDayPath } from '../model/paths';

interface AddAnnotationDialogProps {
  /** Grupos activos del docente. */
  groups: { id: string; name: string }[];
  onClose: () => void;
}

/** «Agregar anotación»: elige el grupo y la fecha (hoy o un día anterior) y abre el diario del día. */
export function AddAnnotationDialog({ groups, onClose }: AddAnnotationDialogProps) {
  const router = useRouter();
  const today = todayInColombia();
  const [groupId, setGroupId] = useState(groups.length === 1 ? (groups[0]?.id ?? '') : '');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<{ group?: string; date?: string }>({});

  function handleContinue() {
    const next: typeof errors = {};
    if (!groupId) {
      next.group = 'Elige el grupo.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = 'Elige la fecha.';
    } else if (date > today) {
      next.date = 'Solo puedes elegir hoy o un día anterior.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) {
      router.push(journalDayPath(groupId, date));
    }
  }

  return (
    <Dialog
      open
      title="Agregar anotación"
      description="Elige el grupo y el día del diario al que quieres agregar tu anotación."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleContinue}>Continuar</Button>
        </>
      }
    >
      <Select
        label="Grupo"
        required
        placeholder="Selecciona el grupo"
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
        value={groupId}
        error={errors.group}
        onChange={(event) => {
          setGroupId(event.target.value);
          setErrors((previous) => ({ ...previous, group: undefined }));
        }}
      />
      <TextInput
        label="Fecha"
        type="date"
        required
        max={today}
        value={date}
        help="Hoy o un día anterior."
        error={errors.date}
        onChange={(event) => {
          setDate(event.target.value);
          setErrors((previous) => ({ ...previous, date: undefined }));
        }}
      />
    </Dialog>
  );
}
