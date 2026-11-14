import {
  teacherModuleSchema,
  teacherRouteSchema,
  TeacherModuleState,
  type TeacherModule,
} from '@gns/shared';
import type {
  RouteActivityRow,
  RoutePlanRow,
  TeacherModuleRow,
} from '../plans/training-plan.repository';
import type {
  ActivityProgressRecord,
  ModuleProgressView,
} from '../progress/training-progress.repository';
import { projectModule, projectRoute, teacherModuleState } from './teacher-projection';

const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const UPDATED = new Date('2026-11-09T10:00:00.000Z');

const wheel: RouteActivityRow = {
  id: ID(1),
  type: 'ruleta_pasaporte',
  title: 'Ruleta',
  isRequired: true,
  instructions: null,
  sortOrder: 1,
  updatedAt: UPDATED,
  config: {
    insignia: 'Insignia',
    tarjetas: ['a', 'b'].map((clave) => ({
      clave,
      emoji: '🙂',
      titulo_corto: clave,
      titulo: `Tarjeta ${clave}`,
      dato: 'dato',
      hechos: ['hecho'],
      pregunta: { enunciado: '¿?', opciones: ['uno', 'dos'], correcta: 1 },
    })),
  },
};
const match: RouteActivityRow = {
  id: ID(2),
  type: 'conecta',
  title: 'Conecta',
  isRequired: true,
  instructions: null,
  sortOrder: 2,
  updatedAt: UPDATED,
  config: {
    pares: [
      { concepto: 'SECRETO-CONCEPTO', dato: 'SECRETO-DATO' },
      { concepto: 'Otro', dato: 'Otro dato' },
    ],
    pares_por_ronda: 2,
    rondas: 1,
    segundos_por_ronda: 30,
    umbral_aprobacion: 80,
  },
};
const myth: RouteActivityRow = {
  id: ID(3),
  type: 'verdad_o_mito',
  title: 'Mitos',
  isRequired: false,
  instructions: null,
  sortOrder: 3,
  updatedAt: UPDATED,
  config: {
    afirmaciones: [
      { texto: 'SECRETO-AFIRMACION', es_verdad: true, explicacion: 'SECRETO-EXPLICACION' },
    ],
    por_partida: 1,
    vidas: 3,
    segundos_por_afirmacion: 10,
    umbral_aprobacion: 70,
  },
};
const simulator: RouteActivityRow = {
  id: ID(4),
  type: 'simulador',
  title: 'Simulador',
  isRequired: false,
  instructions: null,
  sortOrder: 4,
  updatedAt: UPDATED,
  config: {
    entradas: [{ clave: 'x', etiqueta: 'X', tipo: 'numero', min: 0, max: 10, paso: 1, inicial: 1 }],
    constantes: [],
    calculos: [{ clave: 'total', expresion: { ref: 'x' } }],
    resultados: [{ clave: 'total', etiqueta: 'Total', formato: 'numero' }],
    notas: [],
  },
};

const moduleRow: TeacherModuleRow = {
  id: ID(10),
  number: '1',
  title: 'Módulo',
  summary: 'Resumen',
  sortOrder: 1,
  videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
  presentationUrl: null,
  videoFile: null,
  presentationFile: null,
  slideCount: 1,
  questionCount: 3,
  activities: [wheel, match, myth, simulator],
  status: 'activo',
  planId: ID(20),
  planAreaId: null,
  planSchoolYear: null,
  sectionId: ID(30),
  sectionTitle: 'Parte I',
  videoTitle: 'Video',
  approvalThreshold: 80,
  secondsPerQuestion: null,
  slides: [{ id: ID(40), title: 'Diapositiva', keyIdeas: 'Idea' }],
};

const progress = (change: Partial<ModuleProgressView> = {}): ModuleProgressView => ({
  id: ID(50),
  teacherId: ID(60),
  moduleId: ID(10),
  videoViewedAt: null,
  presentationViewedAt: null,
  bestScore: null,
  passedAt: null,
  completedAt: null,
  challengeGame: null,
  attempts: 0,
  bestPoints: null,
  ...change,
});

const activityProgress = (
  change: Partial<ActivityProgressRecord> = {},
): ActivityProgressRecord => ({
  id: ID(70),
  teacherId: ID(60),
  activityId: ID(1),
  completedAt: null,
  bestScore: null,
  bestPoints: null,
  attempts: 0,
  detail: null,
  game: null,
  ...change,
});

const FORBIDDEN =
  /correcta|isCorrect|es_correcta|orden_correcto|respuesta_vf|retroalimentacion|feedback|es_verdad|explicacion|SECRETO|"pares"|afirmaciones/;

describe('teacher projection', () => {
  it('never carries a solution, a pair or a statement', () => {
    const projected = projectModule(moduleRow, undefined, new Map());

    expect(JSON.stringify(projected)).not.toMatch(FORBIDDEN);
    expect(teacherModuleSchema.safeEncode(projected).success).toBe(true);
  });

  it('keeps the data a teacher needs to play', () => {
    const projected: TeacherModule = projectModule(moduleRow, undefined, new Map());

    expect(projected.section).toEqual({ id: ID(30), title: 'Parte I' });
    expect(projected.challenge).toEqual({
      questionCount: 3,
      approvalThreshold: 80,
      secondsPerQuestion: null,
    });
    expect(projected.activities.map((activity) => activity.type)).toEqual([
      'ruleta_pasaporte',
      'conecta',
      'verdad_o_mito',
      'simulador',
    ]);
    const wheelCard = (projected.activities[0] as { config: { tarjetas: { pregunta: object }[] } })
      .config.tarjetas[0];
    expect(wheelCard?.pregunta).toEqual({ enunciado: '¿?', opciones: ['uno', 'dos'] });
  });

  describe('video and presentation origin (R28)', () => {
    const FILE = { id: ID(80), name: 'clase.mp4', contentType: 'video/mp4', size: 1234 };
    const project = (change: Partial<TeacherModuleRow>) =>
      projectModule({ ...moduleRow, ...change }, undefined, new Map());

    it('gives the no-cookie embed URL of a YouTube link and keeps the start', () => {
      const projected = project({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=1m30s' });

      expect(projected).toMatchObject({
        videoSource: 'youtube',
        videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=1m30s',
        videoEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90',
        videoFile: null,
      });
    });

    it('reports a file video without an embed URL or any signed URL', () => {
      const projected = project({ videoUrl: null, videoFile: FILE });

      expect(projected).toMatchObject({
        videoSource: 'archivo',
        videoUrl: null,
        videoEmbedUrl: null,
        videoFile: FILE,
      });
      expect(JSON.stringify(projected)).not.toMatch(
        /X-Amz|formacion\/modulos|clave_objeto|objectKey/,
      );
      expect(teacherModuleSchema.safeEncode(projected).success).toBe(true);
    });

    it('has no source without video and shows the original of an unreadable stored link', () => {
      expect(project({ videoUrl: null })).toMatchObject({ videoSource: null, videoEmbedUrl: null });
      expect(project({ videoUrl: 'https://example.com/no-youtube' })).toMatchObject({
        videoSource: 'youtube',
        videoEmbedUrl: null,
        videoUrl: 'https://example.com/no-youtube',
      });
    });

    it('counts a file as a step in the route summary', () => {
      const plan: RoutePlanRow = {
        id: ID(1),
        name: 'Plan',
        areaId: null,
        areaName: null,
        schoolYear: null,
        sections: [
          {
            id: ID(2),
            title: 'Sección',
            subtitle: null,
            sortOrder: 1,
            modules: [
              {
                ...moduleRow,
                videoUrl: null,
                videoFile: FILE,
                slideCount: 0,
                presentationFile: FILE,
              },
            ],
          },
        ],
      };

      const summary = projectRoute('2026-2027', [plan], new Map(), new Map()).plans[0]?.sections[0]
        ?.modules[0];

      expect(summary).toMatchObject({
        videoSource: 'archivo',
        steps: { video: true, presentation: true },
      });
    });
  });

  it('counts only the stamps that are still cards of the passport', () => {
    const projected = projectModule(
      moduleRow,
      undefined,
      new Map([[ID(1), activityProgress({ detail: { sellos: ['a', 'quitada'] } })]]),
    );

    expect(projected.activities[0]?.progress.stamps).toEqual(['a']);
  });

  it.each([
    [undefined, [], TeacherModuleState.Pending],
    [progress({ completedAt: UPDATED }), [], TeacherModuleState.Done],
    [progress({ videoViewedAt: UPDATED }), [], TeacherModuleState.InProgress],
    [undefined, [activityProgress({ attempts: 1 })], TeacherModuleState.InProgress],
    [progress(), [activityProgress()], TeacherModuleState.Pending],
  ])('derives the state of a module', (moduleProgress, activities, expected) => {
    expect(teacherModuleState(moduleProgress, activities)).toBe(expected);
  });

  it('groups the route by plan and section, General first, and omits empty sections', () => {
    const plan = (id: number, areaId: string | null, areaName: string | null): RoutePlanRow => ({
      id: ID(id),
      name: `Plan ${id}`,
      areaId,
      areaName,
      schoolYear: null,
      sections: [
        { id: ID(id * 100), title: 'Vacía', subtitle: null, sortOrder: 1, modules: [] },
        {
          id: ID(id * 100 + 1),
          title: 'Con módulos',
          subtitle: 'Sub',
          sortOrder: 2,
          modules: [{ ...moduleRow, id: ID(id * 100 + 2), activities: [] }],
        },
      ],
    });

    const route = projectRoute(
      '2026-2027',
      [plan(2, ID(91), 'Matemáticas'), plan(1, null, null)],
      new Map([[ID(102), progress({ moduleId: ID(102), completedAt: UPDATED })]]),
      new Map(),
    );

    expect(route.plans.map((item) => item.name)).toEqual(['Plan 1', 'Plan 2']);
    expect(route.plans[0]?.sections.map((section) => section.title)).toEqual(['Con módulos']);
    expect(route.plans[0]?.totals).toEqual({ modules: 1, completed: 1 });
    expect(route.plans[1]?.totals).toEqual({ modules: 1, completed: 0 });
    expect(teacherRouteSchema.safeEncode(route).success).toBe(true);
  });
});
