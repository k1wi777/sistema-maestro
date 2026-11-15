import type { FieldJournal } from '@gns/shared';

import { Card } from '@/shared/ui';

import styles from './record-screen.module.css';

/**
 * Encabezado del formato F-PA-05 en solo lectura. Grado y periodo son la llave de la hoja y no se
 * cambian: equivocarse es anular la hoja y crear otra.
 */
export function JournalHeader({
  journal,
  levelName,
}: {
  journal: FieldJournal;
  /** Nivel del grado según el catálogo; `null` si no se pudo resolver. */
  levelName: string | null;
}) {
  return (
    <Card title="Encabezado del formato" step={1}>
      <dl className={styles.facts}>
        <div>
          <dt>Año lectivo</dt>
          <dd>{journal.period.schoolYear}</dd>
        </div>
        <div>
          <dt>Nivel</dt>
          <dd>{levelName ?? '—'}</dd>
        </div>
        <div>
          <dt>Grado</dt>
          <dd>{journal.grade.name}</dd>
        </div>
        <div>
          <dt>Periodo</dt>
          <dd>{`Periodo ${journal.period.number}`}</dd>
        </div>
        <div>
          <dt>Docente</dt>
          <dd>{journal.teacher.fullName}</dd>
        </div>
      </dl>
    </Card>
  );
}
