'use client';

import type { SchoolYear, TeacherAssignment, User } from '@gns/shared';
import { useMemo } from 'react';

import type { ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';

import {
  getCurrentSchoolYear,
  listAreas,
  listGrades,
  listGroups,
  listLevels,
  listYearAssignments,
  type CatalogArea,
  type CatalogGrade,
  type CatalogGroup,
  type CatalogLevel,
} from '../api/assignments';
import { listAssignableUsers } from '../api/users';
import { buildRoster, type RosterTeacher } from '../model/roster';

export interface TeachersData {
  /** `null` cuando no hay año lectivo vigente. */
  year: SchoolYear | null;
  assignments: TeacherAssignment[];
  /** Docentes y coordinadores de `/users`: solo se piden si la sesión es de administración. */
  people: User[];
  grades: CatalogGrade[];
  /** Grupos activos (con sus grados) a los que se puede asignar. */
  groups: CatalogGroup[];
  levels: CatalogLevel[];
  areas: CatalogArea[];
}

async function load(isAdmin: boolean): Promise<ApiResult<TeachersData>> {
  const [year, people, grades, areas, groups, levels] = await Promise.all([
    getCurrentSchoolYear(),
    isAdmin ? listAssignableUsers() : Promise.resolve<ApiResult<User[]>>({ ok: true, data: [] }),
    listGrades(),
    listAreas(),
    listGroups(),
    listLevels(),
  ]);
  if (!year.ok) {
    return year;
  }
  if (!people.ok) {
    return people;
  }
  if (!grades.ok) {
    return grades;
  }
  if (!areas.ok) {
    return areas;
  }
  if (!groups.ok) {
    return groups;
  }
  if (!levels.ok) {
    return levels;
  }
  let assignments: TeacherAssignment[] = [];
  if (year.data) {
    const result = await listYearAssignments(year.data.code);
    if (!result.ok) {
      return result;
    }
    assignments = result.data;
  }
  return {
    ok: true,
    data: {
      year: year.data,
      assignments,
      people: people.data,
      grades: [...grades.data].sort((a, b) => a.sortOrder - b.sortOrder),
      groups: groups.data,
      levels: levels.data,
      areas: [...areas.data].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    },
  };
}

/** Datos de la pantalla de docentes; `refresh` los vuelve a pedir sin pasar por la carga. */
export function useTeachersData(isAdmin: boolean): Remote<TeachersData> {
  return useRemote(() => load(isAdmin), `teachers:${isAdmin}`);
}

/** Lista de docentes del año a partir de los datos cargados. */
export function useRoster(data: TeachersData | null): RosterTeacher[] {
  return useMemo(() => (data ? buildRoster(data.assignments, data.people) : []), [data]);
}
