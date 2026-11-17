'use client';

import { AreaType, type AcademicStructure } from '@gns/shared';
import { useState } from 'react';

import { LoadError, Loading } from '@/shared/data';
import {
  Button,
  DataTable,
  Notice,
  PageContainer,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
  type DataTableColumn,
} from '@/shared/ui';

import { deleteArea, deleteGrade, updateArea, updateGrade } from '../api/structure';
import { useAcademicStructure } from '../hooks/use-structure';
import {
  filterAreas,
  gradesOfCoordinator,
  gradesWithoutCoordinator,
  nextGradeOrder,
  levelNamesOf,
  type AreaFilter,
  type StructureArea,
  type StructureCoordinator,
  type StructureGrade,
} from '../model/structure';
import { AREA_TYPE_LABEL, AreaDialog } from './area-dialog';
import { ConfirmRemoveDialog, type RemoveTarget } from './confirm-remove-dialog';
import { CoordinatorDialog } from './coordinator-dialog';
import { AddGroupDialog, GradeDialog, NewGradeDialog } from './grade-dialogs';
import styles from './grados-areas.module.css';

/** Los niveles de primaria y bachillerato arrancan plegados: son los que más grados tienen. */
const FOLDED_FROM_INDEX = 2;

function GradeCard({
  grade,
  onEdit,
  onAddGroup,
  onRemove,
}: {
  grade: StructureGrade;
  onEdit: () => void;
  onAddGroup: () => void;
  onRemove: () => void;
}) {
  return (
    <li className={styles.grade}>
      <div className={styles.gradeHead}>
        <strong>{grade.name}</strong>
        {!grade.active ? <StatusBadge tone="neutral">Inactivo</StatusBadge> : null}
      </div>
      <p className={styles.muted}>
        {grade.coordinator ? `Coordina: ${grade.coordinator.fullName}` : 'Sin coordinadora'}
      </p>
      {grade.groups.length === 0 ? (
        <p className={styles.muted}>Sin grupos. Agrega al menos uno para poder asignar docentes.</p>
      ) : (
        <ul className={styles.groups} aria-label={`Grupos de ${grade.name}`}>
          {grade.groups.map((group) => (
            <li key={group.id} className={styles.group}>
              {`${group.name} · ${group.homeroomTeacher ? `Dir.: ${group.homeroomTeacher.fullName}` : 'Sin director(a)'}`}
              {!group.active ? ' · Inactivo' : ''}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Button variant="outline" size="sm" context={`del grado ${grade.name}`} onClick={onEdit}>
          Editar
        </Button>
        <Button variant="outline" size="sm" context={`a ${grade.name}`} onClick={onAddGroup}>
          Agregar grupo
        </Button>
        {grade.inUse || grade.groups.some((group) => group.inUse) ? null : (
          <Button
            variant="outline"
            size="sm"
            context={`del grado ${grade.name}`}
            onClick={onRemove}
          >
            Borrar
          </Button>
        )}
      </div>
    </li>
  );
}

function GradesPanel({
  structure,
  onNew,
  onEdit,
  onAddGroup,
  onRemove,
}: {
  structure: AcademicStructure;
  onNew: () => void;
  onEdit: (grade: StructureGrade, levelId: string) => void;
  onAddGroup: (grade: StructureGrade) => void;
  onRemove: (grade: StructureGrade) => void;
}) {
  return (
    <div className={styles.levels}>
      <div className={styles.toolbar}>
        <span />
        <Button onClick={onNew}>Nuevo grado</Button>
      </div>
      {structure.schoolYear === null ? (
        <Notice tone="warning" title="Sin año lectivo vigente">
          Sin año lectivo vigente no se muestran los directores de grupo.
        </Notice>
      ) : null}
      {structure.levels.map((level, index) => {
        const grid = (
          <ul className={styles.grades}>
            {level.grades.map((grade) => (
              <GradeCard
                key={grade.id}
                grade={grade}
                onEdit={() => onEdit(grade, level.id)}
                onAddGroup={() => onAddGroup(grade)}
                onRemove={() => onRemove(grade)}
              />
            ))}
          </ul>
        );
        return (
          <section key={level.id} aria-labelledby={`level-${level.id}`}>
            <h3 id={`level-${level.id}`} className={styles.subheading}>
              {level.name}
            </h3>
            {index >= FOLDED_FROM_INDEX ? (
              <details>
                <summary>{`Ver ${level.grades.length} grados`}</summary>
                {grid}
              </details>
            ) : (
              grid
            )}
          </section>
        );
      })}
    </div>
  );
}

function AreasPanel({
  structure,
  onNew,
  onEdit,
  onRemove,
  onToggle,
}: {
  structure: AcademicStructure;
  onNew: () => void;
  onEdit: (area: StructureArea) => void;
  onRemove: (area: StructureArea) => void;
  onToggle: (area: StructureArea) => void;
}) {
  const [filter, setFilter] = useState<AreaFilter>({ type: '', levelId: '' });
  const rows = filterAreas(structure.areas, filter);
  const columns: DataTableColumn<StructureArea>[] = [
    { key: 'name', header: 'Área', render: (area) => area.name },
    { key: 'type', header: 'Tipo', render: (area) => AREA_TYPE_LABEL[area.type] },
    { key: 'levels', header: 'Niveles', render: (area) => levelNamesOf(area, structure.levels) },
    {
      key: 'usage',
      header: 'Uso',
      render: (area) =>
        area.usageCount === 0
          ? 'Sin uso'
          : `${area.usageCount} ${area.usageCount === 1 ? 'registro' : 'registros'}`,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (area) => (
        <StatusBadge tone={area.active ? 'success' : 'neutral'}>
          {area.active ? 'Activa' : 'Inactiva'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (area) => (
        <span className={styles.rowActions}>
          <Button
            variant="outline"
            size="sm"
            context={`del área ${area.name}`}
            onClick={() => onEdit(area)}
          >
            Editar
          </Button>
          {area.usageCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              context={`del área ${area.name}`}
              onClick={() => (area.active ? onRemove(area) : onToggle(area))}
            >
              {area.active ? 'Desactivar' : 'Activar'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              context={`del área ${area.name}`}
              onClick={() => onRemove(area)}
            >
              Borrar
            </Button>
          )}
        </span>
      ),
    },
  ];
  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Select
            label="Tipo"
            value={filter.type}
            placeholder="Todos"
            options={Object.values(AreaType).map((type) => ({
              value: type,
              label: AREA_TYPE_LABEL[type],
            }))}
            onChange={(event) =>
              setFilter({ ...filter, type: event.target.value as AreaType | '' })
            }
          />
          <Select
            label="Nivel"
            value={filter.levelId}
            placeholder="Todos"
            options={structure.levels.map((level) => ({ value: level.id, label: level.name }))}
            onChange={(event) => setFilter({ ...filter, levelId: event.target.value })}
          />
        </div>
        <Button onClick={onNew}>Nueva área</Button>
      </div>
      <DataTable
        caption="Áreas del colegio"
        columns={columns}
        rows={rows}
        getRowKey={(area) => area.id}
        emptyMessage="Ningún área coincide con los filtros."
      />
    </>
  );
}

function CoordinatorsPanel({
  structure,
  onEdit,
}: {
  structure: AcademicStructure;
  onEdit: (coordinator: StructureCoordinator) => void;
}) {
  const missing = gradesWithoutCoordinator(structure);
  const columns: DataTableColumn<StructureCoordinator>[] = [
    { key: 'name', header: 'Coordinadora', render: (item) => item.fullName },
    {
      key: 'grades',
      header: 'Grados',
      render: (item) => {
        const grades = gradesOfCoordinator(structure, item);
        return grades.length === 0 ? 'Sin grados' : grades.map((grade) => grade.name).join(', ');
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          context={`de ${item.fullName}`}
          onClick={() => onEdit(item)}
        >
          Editar grados
        </Button>
      ),
    },
  ];
  return (
    <>
      {missing.length > 0 ? (
        <div className={styles.warnings}>
          {missing.map((grade) => (
            <Notice key={grade.id} tone="warning">
              {`${grade.name} no tiene coordinadora.`}
            </Notice>
          ))}
        </div>
      ) : null}
      <DataTable
        caption="Coordinadoras y sus grados"
        columns={columns}
        rows={structure.coordinators}
        getRowKey={(item) => item.id}
        emptyMessage="No hay coordinadoras activas."
      />
    </>
  );
}

/** «Grados y áreas»: grados con sus grupos, áreas con sus niveles y coordinadoras por grado. */
export function AcademicStructureScreen() {
  const remote = useAcademicStructure();
  const structure = remote.state.status === 'ready' ? remote.state.data : null;
  const [gradeTarget, setGradeTarget] = useState<{ gradeId: string; levelId: string } | null>(null);
  const [newGradeOpen, setNewGradeOpen] = useState(false);
  const [addGroupFor, setAddGroupFor] = useState<string | null>(null);
  const [areaOpen, setAreaOpen] = useState<{ areaId: string | null } | null>(null);
  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<RemoveTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const allGrades = structure?.levels.flatMap((level) => level.grades) ?? [];
  const grade = allGrades.find((item) => item.id === gradeTarget?.gradeId) ?? null;
  const groupGrade = allGrades.find((item) => item.id === addGroupFor) ?? null;
  const area = structure?.areas.find((item) => item.id === areaOpen?.areaId) ?? null;
  const coordinator = structure?.coordinators.find((item) => item.id === coordinatorId) ?? null;

  async function after() {
    const failure = await remote.refresh();
    if (failure) {
      setActionError(failure.message);
    }
  }

  async function toggleArea(target: StructureArea) {
    setActionError(null);
    const result = await updateArea(target.id, { active: !target.active });
    if (result.ok) {
      await after();
    } else {
      setActionError(result.error.message);
    }
  }

  function removeArea(target: StructureArea) {
    setRemoval({
      what: `el área ${target.name}`,
      inUse: target.usageCount > 0,
      run: async (decision) => {
        const result =
          decision === 'delete'
            ? await deleteArea(target.id)
            : await updateArea(target.id, { active: false });
        return result;
      },
    });
  }

  function removeGrade(target: StructureGrade) {
    setRemoval({
      what: `el grado ${target.name}`,
      inUse: target.inUse,
      run: async (decision) =>
        decision === 'delete' ? deleteGrade(target.id) : updateGrade(target.id, { active: false }),
    });
  }

  return (
    <PageContainer>
      <PageHeader
        context="Coordinación académica"
        title="Grados y áreas"
        description="Organiza grados, grupos, áreas y coordinadoras. Lo que no se use se borra; lo que tiene registros se desactiva."
      />
      <div className={styles.root}>
        {remote.state.status === 'loading' ? <Loading>Cargando grados y áreas…</Loading> : null}
        {remote.state.status === 'error' ? (
          <LoadError
            error={remote.state.error}
            title="No pudimos cargar grados y áreas"
            onRetry={remote.reload}
          />
        ) : null}
        {actionError ? (
          <Notice tone="error" title="No se pudo completar la acción">
            {actionError}
          </Notice>
        ) : null}
        {structure ? (
          <Tabs
            label="Secciones de grados y áreas"
            tabs={[
              {
                id: 'grados',
                label: 'Grados y grupos',
                content: (
                  <div className={styles.panel}>
                    <GradesPanel
                      structure={structure}
                      onNew={() => setNewGradeOpen(true)}
                      onEdit={(item, levelId) => setGradeTarget({ gradeId: item.id, levelId })}
                      onAddGroup={(item) => setAddGroupFor(item.id)}
                      onRemove={removeGrade}
                    />
                  </div>
                ),
              },
              {
                id: 'areas',
                label: 'Áreas',
                content: (
                  <div className={styles.panel}>
                    <AreasPanel
                      structure={structure}
                      onNew={() => setAreaOpen({ areaId: null })}
                      onEdit={(item) => setAreaOpen({ areaId: item.id })}
                      onRemove={removeArea}
                      onToggle={(item) => void toggleArea(item)}
                    />
                  </div>
                ),
              },
              {
                id: 'coordinadoras',
                label: 'Coordinadoras',
                content: (
                  <div className={styles.panel}>
                    <CoordinatorsPanel
                      structure={structure}
                      onEdit={(item) => setCoordinatorId(item.id)}
                    />
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </div>

      <GradeDialog
        target={grade && gradeTarget ? { grade, levelId: gradeTarget.levelId } : null}
        levels={structure?.levels ?? []}
        onChanged={after}
        onAddGroup={(item) => setAddGroupFor(item.id)}
        onRemove={setRemoval}
        onClose={() => setGradeTarget(null)}
      />
      <NewGradeDialog
        open={newGradeOpen}
        levels={structure?.levels ?? []}
        defaultOrder={structure ? nextGradeOrder(structure) : 1}
        onDone={() => {
          setNewGradeOpen(false);
          void after();
        }}
        onClose={() => setNewGradeOpen(false)}
      />
      <AddGroupDialog
        grade={groupGrade}
        onDone={() => {
          setAddGroupFor(null);
          void after();
        }}
        onClose={() => setAddGroupFor(null)}
      />
      <AreaDialog
        open={areaOpen !== null}
        area={area}
        levels={structure?.levels ?? []}
        onDone={() => {
          setAreaOpen(null);
          void after();
        }}
        onClose={() => setAreaOpen(null)}
      />
      <CoordinatorDialog
        coordinator={coordinator}
        levels={structure?.levels ?? []}
        onDone={() => {
          setCoordinatorId(null);
          void after();
        }}
        onClose={() => setCoordinatorId(null)}
      />
      <ConfirmRemoveDialog
        target={removal}
        onDone={() => {
          setRemoval(null);
          void after();
        }}
        onClose={() => setRemoval(null)}
      />
    </PageContainer>
  );
}
