'use client';

import { LoadError, Loading } from '@/shared/data';
import { formatDateTime } from '@/shared/format/dates';
import { Button, Dialog } from '@/shared/ui';

import { useAuditEntry } from '../hooks/use-audit-log';
import { NO_DATA, describeAuditData } from '../model/audit-detail';
import { auditRoleLabel, auditTypeLabel } from '../model/labels';
import styles from './audit-detail-dialog.module.css';

function DetailBody({ id }: { id: string }) {
  const remote = useAuditEntry(id);
  if (remote.state.status === 'loading') {
    return <Loading>Cargando el movimiento…</Loading>;
  }
  if (remote.state.status === 'error') {
    return (
      <LoadError
        error={remote.state.error}
        title="No pudimos cargar el movimiento"
        onRetry={remote.reload}
      />
    );
  }
  const entry = remote.state.data;
  const view = describeAuditData(entry.dataBefore, entry.dataAfter);
  return (
    <>
      <dl className={styles.summary}>
        <dt>Fecha y hora</dt>
        <dd>{formatDateTime(entry.occurredAt)}</dd>
        <dt>Usuario</dt>
        <dd>{entry.user ? `${entry.user.name} · ${auditRoleLabel(entry.role)}` : 'Sin sesión'}</dd>
        <dt>Tipo</dt>
        <dd>{auditTypeLabel(entry.type)}</dd>
        <dt>Acción</dt>
        <dd>{entry.action}</dd>
        {entry.entity ? (
          <>
            <dt>Registro</dt>
            <dd>{entry.entity}</dd>
          </>
        ) : null}
        <dt>Detalle</dt>
        <dd>{entry.detail ?? '—'}</dd>
      </dl>
      {view.kind === 'rows' ? (
        <>
          {view.missing.length > 0 ? (
            <p className={styles.missing}>
              {view.missing
                .map((side) => `${side === 'before' ? 'Antes' : 'Después'}: ${NO_DATA}`)
                .join(' · ')}
            </p>
          ) : null}
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Datos antes y después"
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  <th scope="col">Antes</th>
                  <th scope="col">Después</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr key={row.field}>
                    <th scope="row">{row.field}</th>
                    <td>{row.before ?? '—'}</td>
                    <td>{row.after ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={styles.blocks}>
          <section>
            <h3 className={styles.blockTitle}>Antes</h3>
            <pre className={styles.pre}>{view.before}</pre>
          </section>
          <section>
            <h3 className={styles.blockTitle}>Después</h3>
            <pre className={styles.pre}>{view.after}</pre>
          </section>
        </div>
      )}
    </>
  );
}

/** Detalle de un movimiento: lo que guardó la bitácora, sin traducir ni completar. */
export function AuditDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={id !== null}
      wide
      title="Detalle del movimiento"
      description="Datos tal como quedaron guardados en la bitácora. No se pueden modificar."
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {id ? <DetailBody key={id} id={id} /> : null}
    </Dialog>
  );
}
