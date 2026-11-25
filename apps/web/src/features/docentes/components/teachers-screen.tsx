'use client';

import { UserRole, UserStatus } from '@gns/shared';
import { useMemo, useState } from 'react';

import { LoadError, Loading, useQueryParams } from '@/shared/data';
import { joinNames } from '@/shared/records';
import { roleLabel, useSession } from '@/shared/session';
import type { User } from '@gns/shared';
import {
  Button,
  ButtonLink,
  Card,
  DataTable,
  FilterBar,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
  Tabs,
  TextInput,
  type DataTableColumn,
} from '@/shared/ui';
import { useView } from '@/shared/shell';

import { useRoster, useTeachersData } from '../hooks/use-teachers';
import { roleChangeConsequences } from '../model/role-change';
import { filterRoster, type RosterTeacher } from '../model/roster';
import { AssignmentsDialog } from './assignments-dialog';
import styles from './teachers-screen.module.css';
import { UsersPanel } from './users-panel';

function GradesCell({ teacher }: { teacher: RosterTeacher }) {
  if (teacher.groups.length === 0) {
    return (
      <span className={styles.muted}>
        {teacher.unassigned ? 'Sin asignar' : 'Sin asignaciones activas'}
        {teacher.withdrawnCount > 0 ? ` · ${teacher.withdrawnCount} retirada(s)` : ''}
      </span>
    );
  }
  return (
    <ul className={styles.grades}>
      {teacher.groups.map((group) => (
        <li key={group.id}>
          <strong>{group.name}</strong>
          {group.isHomeroom ? <span className={styles.tag}>Director(a) de este grupo</span> : null}
          <span
            className={styles.muted}
          >{` · ${group.areas.map((area) => area.name).join(', ')}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** Docentes y asignaciones del año vigente; para administración, también usuarios y roles. */
export function TeachersScreen() {
  const view = useView();
  const activityPath = `${view.path}/bitacora`;
  const { state } = useSession();
  const user = state.status === 'authenticated' ? state.user : null;
  // La vista decide qué se ve: administración tiene rol y «Usuarios y roles»; coordinación, no.
  const isAdmin = user?.role === UserRole.Administrator;
  const { params, update } = useQueryParams();
  const tab = params.get('pestana') === 'usuarios' ? 'usuarios' : 'asignaciones';
  const remote = useTeachersData(isAdmin);
  const data = remote.state.status === 'ready' ? remote.state.data : null;
  const roster = useRoster(data);
  // Coordinación solo asigna en los grupos de sus grados; administración, en cualquiera.
  const myGrades = useMemo(
    () => (data?.grades ?? []).filter((grade) => grade.coordinator?.id === user?.id),
    [data, user?.id],
  );
  const allowedGradeIds = useMemo(
    () => (isAdmin ? null : new Set(myGrades.map((grade) => grade.id))),
    [isAdmin, myGrades],
  );
  const scopeHint = isAdmin
    ? undefined
    : myGrades.length > 0
      ? `Solo asignas en los grupos de tus grados: ${joinNames(myGrades.map((grade) => grade.name))}.`
      : 'Aún no tienes grados asignados: puedes consultar las asignaciones, pero no cambiarlas.';
  const consequences = (target: User, to: UserRole) =>
    roleChangeConsequences({
      name: target.fullName,
      from: target.role,
      to,
      groups: (roster.find((teacher) => teacher.id === target.id)?.groups ?? []).map((group) => ({
        name: group.name,
        isHomeroom: group.isHomeroom,
      })),
      coordinatedGrades: (data?.grades ?? [])
        .filter((grade) => grade.coordinator?.id === target.id)
        .map((grade) => grade.name),
    });
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
      header: 'Grupos y áreas',
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
          {isAdmin ? (
            <ButtonLink
              context={`de ${teacher.name}`}
              variant="outline"
              size="sm"
              href={`${activityPath}?userId=${teacher.id}`}
            >
              Actividad
            </ButtonLink>
          ) : null}
        </span>
      ),
    },
  ];

  const assignmentsBody = (
    <>
      {data ? (
        <>
          {data.year === null ? (
            <Notice tone="warning" title="Sin año lectivo vigente">
              Administración debe definir el año lectivo vigente para poder asignar grados y áreas.
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
          <Card title="Docentes del año lectivo" className={styles.panel}>
            <FilterBar label="Buscar docente" compact>
              <TextInput
                size="sm"
                label="Buscar docente"
                type="search"
                placeholder="Nombre"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FilterBar>
            <DataTable
              embedded
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
          </Card>
        </>
      ) : null}
    </>
  );

  return (
    <PageContainer>
      <PageHeader
        context={view.title}
        title="Docentes y asignaciones"
        description={
          isAdmin
            ? 'Asignaciones de los docentes en el año lectivo vigente y usuarios y roles de la plataforma.'
            : 'Grupos y áreas de cada docente en el año lectivo vigente.'
        }
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
        {isAdmin ? (
          <Tabs
            label="Docentes y asignaciones"
            value={tab}
            onChange={(id) => update({ pestana: id === 'usuarios' ? id : null })}
            tabs={[
              { id: 'asignaciones', label: 'Asignaciones', content: assignmentsBody },
              {
                id: 'usuarios',
                label: 'Usuarios y roles',
                content: user ? (
                  <UsersPanel
                    currentUserId={user.id}
                    consequences={consequences}
                    coordinatedGrades={(id) =>
                      (data?.grades ?? [])
                        .filter((grade) => grade.coordinator?.id === id)
                        .map((grade) => grade.name)
                    }
                    onChanged={() => void remote.refresh()}
                  />
                ) : null,
              },
            ]}
          />
        ) : (
          assignmentsBody
        )}
      </div>
      <AssignmentsDialog
        teacher={selected}
        grades={data?.grades ?? []}
        groups={data?.groups ?? []}
        levels={data?.levels ?? []}
        areas={data?.areas ?? []}
        noYear={data?.year === null}
        allowedGradeIds={allowedGradeIds}
        scopeHint={scopeHint}
        onChanged={remote.refresh}
        onClose={() => setOpenId(null)}
      />
    </PageContainer>
  );
}
