'use client';

import type { AuditLogEntry } from '@gns/shared';

import { formatDateTime } from '@/shared/format/dates';
import { Button, DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';

import { auditRoleLabel, auditTypeLabel } from '../model/labels';
import styles from './audit-log-list.module.css';

interface AuditLogListProps {
  entries: AuditLogEntry[];
  emptyMessage: string;
  onOpen: (entry: AuditLogEntry) => void;
  onFilterUser: (userId: string) => void;
}

function RowActions({
  entry,
  onOpen,
  onFilterUser,
}: { entry: AuditLogEntry } & Pick<AuditLogListProps, 'onOpen' | 'onFilterUser'>) {
  const who = entry.user?.name ?? 'sin sesión';
  const user = entry.user;
  return (
    <span className={styles.actions}>
      <Button variant="outline" size="sm" onClick={() => onOpen(entry)}>
        Ver detalle
        <span className="sr-only">{`: ${entry.action} de ${who}`}</span>
      </Button>
      {user ? (
        <Button variant="outline" size="sm" onClick={() => onFilterUser(user.id)}>
          Ver solo este usuario
          <span className="sr-only">{`: ${user.name}`}</span>
        </Button>
      ) : null}
    </span>
  );
}

/**
 * Movimientos de la bitácora: tabla en pantallas anchas y tarjetas en ≤ 860 px. Solo lectura:
 * las únicas acciones abren el detalle o filtran por usuario.
 */
export function AuditLogList({ entries, emptyMessage, onOpen, onFilterUser }: AuditLogListProps) {
  const columns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: 'date',
      header: 'Fecha y hora',
      render: (entry) => <span className={styles.nowrap}>{formatDateTime(entry.occurredAt)}</span>,
    },
    {
      key: 'user',
      header: 'Usuario',
      render: (entry) => (
        <span className={styles.who}>
          <strong>{entry.user?.name ?? 'Sin sesión'}</strong>
          <span className={styles.muted}>{auditRoleLabel(entry.role)}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (entry) => <StatusBadge>{auditTypeLabel(entry.type)}</StatusBadge>,
    },
    { key: 'action', header: 'Acción', render: (entry) => entry.action },
    {
      key: 'detail',
      header: 'Detalle',
      render: (entry) => <span className={styles.detail}>{entry.detail ?? '—'}</span>,
    },
    {
      key: 'open',
      header: 'Acciones',
      render: (entry) => <RowActions entry={entry} onOpen={onOpen} onFilterUser={onFilterUser} />,
    },
  ];

  return (
    <>
      <DataTable
        caption="Movimientos de la bitácora"
        className={styles.tableView}
        columns={columns}
        rows={entries}
        getRowKey={(entry) => entry.id}
        emptyMessage={emptyMessage}
      />
      <div className={styles.cardView}>
        {entries.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          <ul className={styles.cards} aria-label="Movimientos de la bitácora">
            {entries.map((entry) => (
              <li key={entry.id} className={styles.card}>
                <span className={styles.cardHead}>
                  <span className={styles.muted}>{formatDateTime(entry.occurredAt)}</span>
                  <StatusBadge>{auditTypeLabel(entry.type)}</StatusBadge>
                </span>
                <strong>{entry.action}</strong>
                <span className={styles.who}>
                  <span>{entry.user?.name ?? 'Sin sesión'}</span>
                  <span className={styles.muted}>{auditRoleLabel(entry.role)}</span>
                </span>
                {entry.detail ? <span className={styles.detail}>{entry.detail}</span> : null}
                <RowActions entry={entry} onOpen={onOpen} onFilterUser={onFilterUser} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
