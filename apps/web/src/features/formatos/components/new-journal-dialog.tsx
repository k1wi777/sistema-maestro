'use client';

import { createFieldJournalSchema } from '@gns/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LoadError, Loading } from '@/shared/data';
import { Button, Dialog, Notice, Select } from '@/shared/ui';

import { createFieldJournal } from '../api/field-journals';
import {
  NO_SCHOOL_YEAR_STATUS,
  useJournalTargets,
  type JournalTargets,
} from '../hooks/use-format-catalogs';
import { JOURNAL_LIST_PATH } from '../model/paths';

interface Failure {
  fields: { gradeId?: string; periodId?: string };
  message: string | null;
}

function NewJournalForm({ targets, onClose }: { targets: JournalTargets; onClose: () => void }) {
  const router = useRouter();
  const [gradeId, setGradeId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const parsed = createFieldJournalSchema.safeParse({ gradeId, periodId });
    if (!parsed.success) {
      setFailure({
        fields: {
          ...(gradeId ? {} : { gradeId: 'Elige el grado.' }),
          ...(periodId ? {} : { periodId: 'Elige el periodo.' }),
        },
        message: null,
      });
      return;
    }
    setBusy(true);
    setFailure(null);
    const result = await createFieldJournal(parsed.data);
    if (!result.ok) {
      setBusy(false);
      const apiFields = result.error.statusCode === 400 ? (result.error.errors ?? []) : [];
      const reasonOf = (field: string) => apiFields.find((entry) => entry.field === field)?.reason;
      const fields = { gradeId: reasonOf('gradeId'), periodId: reasonOf('periodId') };
      // Los motivos por campo se pintan junto al campo; el resto (403 sin asignación, 409 hoja repetida) va en el aviso.
      setFailure({
        fields,
        message: fields.gradeId || fields.periodId ? null : result.error.message,
      });
      return;
    }
    router.push(`${JOURNAL_LIST_PATH}/${result.data.id}`);
  }

  return (
    <Dialog
      open
      title="Nueva hoja de diario"
      description="Cada hoja corresponde a un grado y un periodo. Una vez creada no se pueden cambiar: si te equivocas, anúlala y crea otra."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || targets.grades.length === 0}
            onClick={() => void handleCreate()}
          >
            {busy ? 'Creando…' : 'Crear hoja'}
          </Button>
        </>
      }
    >
      {targets.grades.length === 0 ? (
        <Notice tone="warning" title="Aún no tienes grados asignados">
          Coordinación debe asignarte un grado para el año {targets.schoolYear} antes de que puedas
          crear una hoja de diario.
        </Notice>
      ) : (
        <>
          <Select
            label="Grado"
            required
            placeholder="Selecciona el grado"
            options={targets.grades.map((grade) => ({ value: grade.id, label: grade.name }))}
            value={gradeId}
            error={failure?.fields.gradeId}
            onChange={(event) => setGradeId(event.target.value)}
          />
          <Select
            label="Periodo"
            required
            placeholder="Selecciona el periodo"
            help={`Año lectivo ${targets.schoolYear}`}
            options={targets.periods.map((period) => ({
              value: period.id,
              label: `Periodo ${period.number}`,
            }))}
            value={periodId}
            error={failure?.fields.periodId}
            onChange={(event) => setPeriodId(event.target.value)}
          />
        </>
      )}
      {failure?.message ? <Notice tone="error">{failure.message}</Notice> : null}
    </Dialog>
  );
}

/** Crea la hoja del diario (grado asignado y periodo vigente) y abre su detalle. */
export function NewJournalDialog({ onClose }: { onClose: () => void }) {
  const targets = useJournalTargets();
  let body;
  if (targets.state.status === 'loading') {
    body = <Loading>Preparando el formulario…</Loading>;
  } else if (targets.state.status === 'error') {
    body =
      targets.state.error.statusCode === NO_SCHOOL_YEAR_STATUS ? (
        <Notice tone="warning" title="No hay un año lectivo vigente">
          Todavía no se puede crear una hoja de diario porque la administración no ha definido el
          año lectivo. Inténtalo cuando esté disponible.
        </Notice>
      ) : (
        <LoadError error={targets.state.error} onRetry={targets.reload} />
      );
  }
  if (body) {
    return (
      <Dialog
        open
        title="Nueva hoja de diario"
        onClose={onClose}
        footer={
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        {body}
      </Dialog>
    );
  }
  if (targets.state.status !== 'ready') {
    return null;
  }
  return <NewJournalForm targets={targets.state.data} onClose={onClose} />;
}
