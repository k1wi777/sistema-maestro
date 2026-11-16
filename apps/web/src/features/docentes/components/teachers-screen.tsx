'use client';

import { UserRole, UserStatus } from '@gns/shared';
import { useState } from 'react';

import { LoadError, Loading } from '@/shared/data';
import { roleLabel, useSession } from '@/shared/session';
import {
  Button,
  ButtonLink,
  DataTable,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
  TextInput,
  type DataTableColumn,
} from '@/shared/ui';

import { useRoster, useTeachersData } from '../hooks/use-teachers';
import { filterRoster, type RosterTeacher } from '../model/roster';
import { AssignmentsDialog } from './assignments-dialog';
import styles from './teachers-screen.module.css';
import { UsersPanel } from './users-panel';

const ACTIVITY_PATH = '/coordinacion/bitacora';

function GradesCell({ teacher }: { teacher: RosterTeacher }) {
  if (teacher.grades.length === 0) {
    return (
      <span className={styles.muted}>
        {teacher.unassigned ? 'Sin asignar' : 'Sin asignaciones activas'}
        {teacher.withdrawnCount > 0 ? ` · ${teacher.withdrawnCount} retirada(s)` : ''}
      </span>
    );
  }
  return (
    <ul className={styles.grades}>
      {teacher.grades.map((grade) => (
        <li key={grade.id}>
          <strong>{grade.name}</strong>
          {grade.isHomeroom ? <span className={styles.tag}>Director(a) de grupo</span> : null}
          <span
            className={styles.muted}
          >{` · ${grade.areas.map((area) => area.name).join(', ')}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** Docentes y asignaciones del año vigente; para administración, también usuarios y roles. */
export function TeachersScreen() {
  const { state } = useSession();
  const isAdmin = state.status === 'authenticated' && state.user.role === UserRole.Administrator;
  const remote = useTeachersData(isAdmin);
  const data = remote.state.status === 'ready' ? remote.state.data : null;
  const roster = useRoster(data);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = filterRoster(roster, search);
  const selected = roster.find((teacher) => teacher.id === openId) ?? null;

  const columns: DataTableColumn<RosterTeacher>[] = [
    { key: 'name', header: 'Docente', render: (teacher) => teacher.name },
    ...(isAdmin
      ? [
          {
            key: 'role',
            header: 'Rol',
            render: (teacher: RosterTeacher) => (teacher.role ? roleLabel(teacher.role) : '—'),
          },
        ]
      : []),
    {
      key: 'grades',
      header: 'Grados y áreas',
      render: (teacher) => <GradesCell teacher={teacher} />,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (teacher) => (
        <StatusBadge tone={teacher.status === UserStatus.Active ? 'success' : 'neutral'}>
          {teacher.status === UserStatus.Active ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (teacher) => (
        <span className={styles.actions}>
          <Button
            context={`de ${teacher.name}`}
            variant="outline"
            size="sm"
            onClick={() => setOpenId(teacher.id)}
          >
            Asignaciones
          </Button>
          <ButtonLink
            context={`de ${teacher.name}`}
            variant="outline"
            size="sm"
            href={`${ACTIVITY_PATH}?userId=${teacher.id}`}
          >
            Actividad
          </ButtonLink>
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Docentes y asignaciones"
        description="Grados, grupos y áreas de cada docente en el año lectivo vigente."
      />
      <div className={styles.root}>
        {remote.state.status === 'loading' ? <Loading>Cargando los docentes…</Loading> : null}
        {remote.state.status === 'error' ? (
          <LoadError
            error={remote.state.error}
            title="No pudimos cargar los docentes"
            onRetry={remote.reload}
          />
        ) : null}
        {data ? (
          <>
            {data.year === null ? (
              <Notice tone="warning" title="Sin año lectivo vigente">
                Administración debe definir el año lectivo vigente para poder asignar grados y
                áreas.
              </Notice>
            ) : (
              <p className={styles.year}>{`Año lectivo ${data.year.code}`}</p>
            )}
            {isAdmin ? null : (
              <Notice tone="info">
                Un docente nuevo aparece en esta lista cuando administración le hace su primera
                asignación.
              </Notice>
            )}
            <TextInput
              label="Buscar docente"
              type="search"
              placeholder="Nombre"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <DataTable
              caption="Docentes del año lectivo"
              columns={columns}
              rows={visible}
              getRowKey={(teacher) => teacher.id}
              emptyMessage={
                search.trim() === ''
                  ? 'Aún no hay docentes con asignaciones en este año.'
                  : 'Ningún docente coincide con la búsqueda.'
              }
            />
          </>
        ) : null}
        {isAdmin ? <UsersPanel onChanged={() => void remote.refresh()} /> : null}
      </div>
      <AssignmentsDialog
        teacher={selected}
        grades={data?.grades ?? []}
        areas={data?.areas ?? []}
        noYear={data?.year === null}
        onChanged={remote.refresh}
        onClose={() => setOpenId(null)}
      />
    </PageContainer>
  );
}
