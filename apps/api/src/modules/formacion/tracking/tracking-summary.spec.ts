import { TrackingModuleState } from '@gns/shared';
import {
  EXPORT_HEADER,
  exportFileName,
  exportRows,
  summarizePlan,
  trackingState,
  type TrackedModule,
  type TrackedProgress,
} from './tracking-summary';

const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DONE = new Date('2026-11-13T15:00:00.000Z');
const PLAN = { id: ID(1), name: 'Plan', areaId: null, areaName: null, schoolYear: null };

const modules: TrackedModule[] = [
  { id: ID(10), number: '1', title: 'Uno', sectionTitle: 'Parte I' },
  { id: ID(11), number: '2', title: 'Dos', sectionTitle: 'Parte I' },
];
const progress = (teacher: number, module: number, change: Partial<TrackedProgress> = {}) => ({
  teacherId: ID(teacher),
  moduleId: ID(module),
  completedAt: null,
  bestScore: null,
  ...change,
});

describe('trackingState', () => {
  it('derives the state from the progress row', () => {
    expect(trackingState(undefined)).toBe(TrackingModuleState.NotStarted);
    expect(trackingState(progress(20, 10))).toBe(TrackingModuleState.InProgress);
    expect(trackingState(progress(20, 10, { completedAt: DONE }))).toBe(TrackingModuleState.Done);
  });
});

describe('summarizePlan', () => {
  const teachers = [
    { id: ID(21), name: 'Zoe' },
    { id: ID(20), name: 'Álvaro' },
    { id: ID(22), name: 'Marta' },
  ];
  const rows = [
    progress(20, 10, { completedAt: DONE, bestScore: 90 }),
    progress(20, 11),
    progress(21, 10, { bestScore: 40 }),
  ];

  it('builds one cell per teacher and module, teachers ordered by name', () => {
    const result = summarizePlan(PLAN, modules, teachers, rows);

    expect(result.teachers.map((teacher) => teacher.name)).toEqual(['Álvaro', 'Marta', 'Zoe']);
    expect(result.teachers[0]?.modules).toEqual([
      { moduleId: ID(10), state: 'terminado', completedAt: DONE, bestScore: 90 },
      { moduleId: ID(11), state: 'en_curso', completedAt: null, bestScore: null },
    ]);
    expect(result.teachers[1]?.modules.map((cell) => cell.state)).toEqual([
      'sin_iniciar',
      'sin_iniciar',
    ]);
  });

  it('totals the states of every module', () => {
    const result = summarizePlan(PLAN, modules, teachers, rows);

    expect(result.modules.map((module) => module.totals)).toEqual([
      { notStarted: 1, inProgress: 1, done: 1 },
      { notStarted: 2, inProgress: 1, done: 0 },
    ]);
  });

  it('ignores progress of teachers outside the scope', () => {
    const result = summarizePlan(
      PLAN,
      modules,
      [teachers[1] as (typeof teachers)[number]],
      [...rows, progress(99, 10, { completedAt: DONE })],
    );

    expect(result.modules[0]?.totals).toEqual({ notStarted: 0, inProgress: 0, done: 1 });
    expect(result.teachers).toHaveLength(1);
  });

  it('returns the plan with no teachers or no modules without failing', () => {
    expect(summarizePlan(PLAN, modules, [], rows).teachers).toEqual([]);
    expect(summarizePlan(PLAN, [], teachers, rows).modules).toEqual([]);
  });
});

describe('export', () => {
  const teachers = [
    { id: ID(20), name: '=Ana' },
    { id: ID(21), name: 'Beto' },
  ];
  const tracking = summarizePlan({ ...PLAN, name: 'Plan de Matemáticas' }, modules, teachers, [
    progress(20, 10, { completedAt: DONE, bestScore: 90 }),
    progress(21, 11),
  ]);

  it('has fixed Spanish columns and one row per teacher and module', () => {
    const rows = exportRows(tracking, new Set([`${ID(20)}:${ID(10)}`]));

    expect(EXPORT_HEADER).toEqual([
      'Plan',
      'Sección',
      'Módulo',
      'Docente',
      'Estado',
      'Fecha de terminación',
      'Mejor puntaje (%)',
      'Certificado',
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual([
      'Plan de Matemáticas',
      'Parte I',
      '1. Uno',
      '=Ana',
      'Terminado',
      '2026-11-13 10:00',
      90,
      'sí',
    ]);
    expect(rows[1]).toEqual([
      'Plan de Matemáticas',
      'Parte I',
      '2. Dos',
      '=Ana',
      'Sin iniciar',
      '',
      null,
      'no',
    ]);
    expect(rows[3]?.[4]).toBe('En curso');
  });

  it('never exports emails, codes, URLs or keys', () => {
    const text = JSON.stringify(exportRows(tracking, new Set()));

    expect(text).not.toMatch(/@|https?:|X-Amz|formacion\/modulos|certificados\//);
  });

  it('builds an ASCII file name with the plan and the date', () => {
    expect(exportFileName('Plan de Matemáticas / 2026', new Date('2026-11-14T02:30:00.000Z'))).toBe(
      'seguimiento-plan-de-matematicas-2026-2026-11-13.csv',
    );
    expect(exportFileName('¿¡?!', DONE)).toBe('seguimiento-plan-2026-11-13.csv');
  });
});
