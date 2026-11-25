'use client';

import { ApiErrorCode, AUDIT_UNKNOWN_ROLE, AuditLogType, UserRole } from '@gns/shared';
import { useMemo, useState } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import {
  Button,
  Card,
  FilterBar,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  TextInput,
  type SelectOption,
} from '@/shared/ui';
import { useView } from '@/shared/shell';

import { useAssignedTeachers, useAuditExport, useAuditLog } from '../hooks/use-audit-log';
import {
  auditFiltersFromParams,
  dateRangeError,
  hasActiveAuditFilters,
} from '../model/audit-filters';
import { AUDIT_ROLE_LABELS, AUDIT_TYPE_LABELS } from '../model/labels';
import { buildUserOptions } from '../model/user-options';
import { AuditDetailDialog } from './audit-detail-dialog';
import { AuditLogList } from './audit-log-list';
import styles from './audit-log-screen.module.css';

const TYPE_OPTIONS: SelectOption[] = Object.values(AuditLogType).map((type) => ({
  value: type,
  label: AUDIT_TYPE_LABELS[type],
}));
const ROLE_OPTIONS: SelectOption[] = [
  UserRole.Teacher,
  UserRole.Coordinator,
  UserRole.Administrator,
  AUDIT_UNKNOWN_ROLE,
].map((role) => ({ value: role, label: AUDIT_ROLE_LABELS[role] ?? role }));

/** Bitácora de actividad: solo lectura, con filtros en la URL, detalle y exportación a CSV. */
export function AuditLogScreen() {
  const view = useView();
  const { params, update } = useQueryParams();
  const filters = auditFiltersFromParams(params);
  const rangeError = dateRangeError(filters);
  const list = useAuditLog(filters, rangeError !== null);
  const teachers = useAssignedTeachers();
  const exporter = useAuditExport(filters);
  const [openId, setOpenId] = useState<string | null>(null);

  const userOptions = useMemo(
    () =>
      buildUserOptions(
        teachers.state.status === 'ready' ? teachers.state.data : [],
        list.items.map((entry) => entry.user),
        filters.userId,
      ),
    [teachers.state, list.items, filters.userId],
  );

  const exportTooBig = exporter.error?.code === ApiErrorCode.ExportExceedsLimit;

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Bitácora de actividad"
        description="Cada ingreso, registro y revisión de la plataforma, con fecha, hora y usuario. Solo lectura."
        actions={
          <Button
            variant="secondary"
            startIcon="bajar"
            disabled={exporter.busy || rangeError !== null}
            onClick={() => void exporter.start()}
          >
            {exporter.busy ? 'Descargando…' : 'Descargar CSV'}
          </Button>
        }
      />
      <div className={styles.root}>
        {exportTooBig ? (
          <Notice tone="warning" title="Son demasiados movimientos para descargar">
            La exportación supera el límite de filas. Acota los filtros (usuario, tipo o fechas) y
            vuelve a intentarlo.
          </Notice>
        ) : exporter.error ? (
          <Notice tone="error" title="No pudimos descargar el CSV">
            {exporter.error.message}
          </Notice>
        ) : null}
        <Card title="Movimientos de la plataforma" className={styles.panel}>
          <FilterBar label="Filtros de la bitácora">
            <Select
              size="sm"
              label="Usuario"
              placeholder="Todos los usuarios"
              options={userOptions}
              value={filters.userId ?? ''}
              onChange={(event) => update({ userId: event.target.value })}
            />
            <Select
              size="sm"
              label="Rol"
              placeholder="Todos los roles"
              options={ROLE_OPTIONS}
              value={filters.role ?? ''}
              onChange={(event) => update({ role: event.target.value })}
            />
            <Select
              size="sm"
              label="Tipo"
              placeholder="Todos los tipos"
              options={TYPE_OPTIONS}
              value={filters.type ?? ''}
              onChange={(event) => update({ type: event.target.value })}
            />
            <TextInput
              size="sm"
              label="Desde"
              type="date"
              value={filters.from ?? ''}
              onChange={(event) => update({ from: event.target.value })}
            />
            <TextInput
              size="sm"
              label="Hasta"
              type="date"
              value={filters.to ?? ''}
              error={rangeError ?? undefined}
              onChange={(event) => update({ to: event.target.value })}
            />
          </FilterBar>
          {hasActiveAuditFilters(filters) ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update({ userId: null, role: null, type: null, from: null, to: null })
                }
              >
                Quitar los filtros
              </Button>
            </div>
          ) : null}

          {list.status === 'loading' ? <Loading>Cargando los movimientos…</Loading> : null}
          {list.status === 'error' && list.error ? (
            <LoadError
              error={list.error}
              title="No pudimos cargar la bitácora"
              onRetry={list.reload}
            />
          ) : null}
          {list.status === 'ready' && rangeError === null ? (
            <>
              <AuditLogList
                entries={list.items}
                emptyMessage={
                  hasActiveAuditFilters(filters)
                    ? 'Ningún movimiento cumple estos filtros. Cambia o quita alguno para ver más.'
                    : 'Aún no hay movimientos.'
                }
                onOpen={(entry) => setOpenId(entry.id)}
                onFilterUser={(userId) => update({ userId })}
              />
              {list.error ? <LoadError error={list.error} onRetry={list.loadMore} /> : null}
              {list.hasMore ? (
                <div className={styles.more}>
                  <Button variant="outline" disabled={list.loadingMore} onClick={list.loadMore}>
                    {list.loadingMore ? 'Cargando…' : 'Cargar más'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>
      <AuditDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </PageContainer>
  );
}
