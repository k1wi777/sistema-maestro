'use client';

import { UserRole, UserStatus, type User } from '@gns/shared';
import { useState, type FormEvent } from 'react';

import { LoadError, Loading } from '@/shared/data';
import { formatShortDate } from '@/shared/format/dates';
import { roleLabel } from '@/shared/session';
import {
  Button,
  Card,
  DataTable,
  Dialog,
  Notice,
  Select,
  StatusBadge,
  TextInput,
  type DataTableColumn,
} from '@/shared/ui';

import { setUserStatus, type UserFilters } from '../api/users';
import { useUserList } from '../hooks/use-users';
import { deactivationWarning } from '../model/role-change';
import styles from './users-panel.module.css';
import { UserFormDialog } from './user-form-dialog';

const ROLE_OPTIONS = Object.values(UserRole).map((role) => ({
  value: role,
  label: roleLabel(role).charAt(0).toUpperCase() + roleLabel(role).slice(1),
}));
const STATUS_OPTIONS = [
  { value: UserStatus.Active, label: 'Activos' },
  { value: UserStatus.Inactive, label: 'Inactivos' },
];

function StatusDialog({
  user,
  warning,
  onDone,
  onClose,
}: {
  user: User;
  /** Aviso extra al desactivar (grados sin revisión), si lo hay. */
  warning: string | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deactivating = user.status === UserStatus.Active;

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await setUserStatus(
      user.id,
      deactivating ? UserStatus.Inactive : UserStatus.Active,
    );
    setBusy(false);
    if (result.ok) {
      onDone();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <Dialog
      open
      title={deactivating ? 'Desactivar usuario' : 'Activar usuario'}
      description={
        deactivating
          ? `${user.fullName} ya no podrá ingresar a la plataforma. Sus registros se conservan y puedes activarlo de nuevo.${warning ? ` ${warning}` : ''}`
          : `${user.fullName} podrá volver a ingresar a la plataforma.`
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={deactivating ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? 'Guardando…' : deactivating ? 'Desactivar' : 'Activar'}
          </Button>
        </>
      }
    >
      {error ? (
        <Notice tone="error" title="No se pudo cambiar el estado">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
}

type Editing = { kind: 'form'; user: User | null } | { kind: 'status'; user: User } | null;

/** Usuarios y roles: solo se monta para administración. Nada se borra: se desactiva. */
export function UsersPanel({
  currentUserId,
  consequences,
  coordinatedGrades,
  onChanged,
}: {
  /** Persona en sesión: su fila no ofrece cambiar el rol ni el estado. */
  currentUserId: string;
  consequences: (user: User, to: UserRole) => string[];
  /** Nombres de los grados que coordina una persona. */
  coordinatedGrades: (userId: string) => string[];
  onChanged: () => void;
}) {
  const [filters, setFilters] = useState<UserFilters>({});
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const list = useUserList(filters);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchText.trim() || undefined }));
  }

  function done() {
    setEditing(null);
    list.reload();
    onChanged();
  }

  const columns: DataTableColumn<User>[] = [
    { key: 'name', header: 'Nombre', render: (user) => user.fullName },
    {
      key: 'email',
      header: 'Correo',
      render: (user) => <span className={styles.wrap}>{user.email}</span>,
    },
    { key: 'role', header: 'Rol', render: (user) => roleLabel(user.role) },
    {
      key: 'status',
      header: 'Estado',
      render: (user) => (
        <StatusBadge tone={user.status === UserStatus.Active ? 'success' : 'neutral'}>
          {user.status === UserStatus.Active ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    { key: 'created', header: 'Creado', render: (user) => formatShortDate(user.createdAt) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (user) =>
        user.id === currentUserId ? (
          <span className={styles.hint}>Es tu cuenta</span>
        ) : (
          <span className={styles.actions}>
            <Button
              context={`usuario ${user.fullName}`}
              variant="outline"
              size="sm"
              onClick={() => setEditing({ kind: 'form', user })}
            >
              Editar
            </Button>
            <Button
              context={`usuario ${user.fullName}`}
              variant="outline"
              size="sm"
              onClick={() => setEditing({ kind: 'status', user })}
            >
              {user.status === UserStatus.Active ? 'Desactivar' : 'Activar'}
            </Button>
          </span>
        ),
    },
  ];

  return (
    <Card
      title="Usuarios y roles"
      actions={
        <Button startIcon="mas" onClick={() => setEditing({ kind: 'form', user: null })}>
          Nuevo usuario
        </Button>
      }
    >
      <div className={styles.body}>
        <p className={styles.hint}>
          Solo administración crea usuarios y asigna roles: nadie se registra solo. Un usuario no se
          borra, se desactiva.
        </p>
        <form className={styles.filters} role="search" onSubmit={applySearch}>
          <TextInput
            label="Buscar"
            type="search"
            placeholder="Nombre o correo"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            label="Rol"
            placeholder="Todos los roles"
            options={ROLE_OPTIONS}
            value={filters.role ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                role: (event.target.value || undefined) as UserFilters['role'],
              }))
            }
          />
          <Select
            label="Estado"
            placeholder="Todos los estados"
            options={STATUS_OPTIONS}
            value={filters.status ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: (event.target.value || undefined) as UserFilters['status'],
              }))
            }
          />
          <div className={styles.search}>
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </div>
        </form>

        {list.status === 'loading' ? <Loading>Cargando los usuarios…</Loading> : null}
        {list.status === 'error' && list.error ? (
          <LoadError
            error={list.error}
            title="No pudimos cargar los usuarios"
            onRetry={list.reload}
          />
        ) : null}
        {list.status === 'ready' ? (
          <>
            <DataTable
              embedded
              caption="Usuarios de la plataforma"
              columns={columns}
              rows={list.items}
              getRowKey={(user) => user.id}
              emptyMessage="Ningún usuario cumple estos filtros."
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
      </div>
      {editing?.kind === 'form' ? (
        <UserFormDialog
          key={editing.user?.id ?? 'new'}
          user={editing.user}
          consequences={consequences}
          onSaved={done}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === 'status' ? (
        <StatusDialog
          user={editing.user}
          warning={
            editing.user.role === UserRole.Coordinator && editing.user.status === UserStatus.Active
              ? deactivationWarning(coordinatedGrades(editing.user.id))
              : null
          }
          onDone={done}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}
