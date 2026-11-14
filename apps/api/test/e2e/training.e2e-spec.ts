import {
  AuditLogType,
  ChallengeQuestionType,
  TrackingModuleState,
  UserRole,
  type ActivityGameAnswerResult,
  type ActivityGameStep,
  type CertificateList,
  type CertificateSummary,
  type CertificateVerification,
  type ChallengeAnswerResult,
  type ChallengeStep,
  type PlanTracking,
  type TeacherModuleSummary,
  type TeacherRoute,
} from '@gns/shared';
import request from 'supertest';
import { BENEFITS_ACTIVITIES } from '../../prisma/seed/initial/benefits.data.ts';
import { INDUCTION_MODULES } from '../../prisma/seed/initial/induction.data.ts';
import { serverOf } from '../integration/support/session';
import { DemoWorld, type DemoSession } from './support/demo-session';

// Actores: Daniela Fontalba, que no tiene progreso de formación en los datos demo (los otros
// docentes activos ya terminaron o empezaron módulos), y Elena Ravassa, de coordinación.
// Módulo 0: solo Desafío GNS. Módulo 8: sin video, presentación ni preguntas, con dos
// actividades obligatorias (Conecta y ¿Verdad o mito?), que son las que terminan el módulo.
const TEACHER = 'daniela.fontalba';
const COORDINATOR = 'elena.ravassa';
const CHALLENGE_MODULE = '0';
const ACTIVITIES_MODULE = '8';

/** Claves que delatarían una solución en lo que recibe el navegador. */
const SOLUTION_KEYS =
  /"(correcta|isCorrect|es_correcta|orden_correcto|correctPosition|respuesta_vf|trueFalseAnswer|retroalimentacion|feedback|es_verdad|explicacion|pares)"/;

function seedActivity(title: string) {
  const found = BENEFITS_ACTIVITIES.find((activity) => activity.title === title);
  if (!found) {
    throw new Error(`No existe la actividad ${title} en los datos iniciales`);
  }
  return found.config;
}

describe('punta a punta · formación, Desafío GNS y certificados', () => {
  let world: DemoWorld;
  let teacher: DemoSession;
  let coordinator: DemoSession;
  let planId: string;
  const modules = new Map<string, TeacherModuleSummary>();
  let certificate: CertificateSummary;
  const delivered: string[] = [];

  beforeAll(async () => {
    world = await DemoWorld.start();
    teacher = await world.signInAs(TEACHER);
    coordinator = await world.signInAs(COORDINATOR);
  });

  afterAll(async () => {
    await world.close();
  });

  const loadRoute = async (): Promise<void> => {
    const route = (await teacher.call('get', '/me/training/route').expect(200))
      .body as TeacherRoute;
    const plan = route.plans.find((item) => item.areaId === null);
    if (!plan) {
      throw new Error('La ruta del docente no tiene el plan General');
    }
    planId = plan.id;
    for (const module of plan.sections.flatMap((section) => section.modules)) {
      modules.set(module.number ?? '', module);
    }
  };
  const moduleOf = (number: string): TeacherModuleSummary => {
    const found = modules.get(number);
    if (!found) {
      throw new Error(`El módulo ${number} no está en la ruta`);
    }
    return found;
  };

  it('el docente ve su ruta sin progreso y abre el módulo del Desafío', async () => {
    await loadRoute();
    expect(modules.size).toBeGreaterThanOrEqual(9);
    expect(moduleOf(CHALLENGE_MODULE).completedAt).toBeNull();
    expect(moduleOf(ACTIVITIES_MODULE).completedAt).toBeNull();

    const opened = await teacher
      .call('get', `/me/training/modules/${moduleOf(CHALLENGE_MODULE).id}`)
      .expect(200);
    expect(opened.text).not.toMatch(SOLUTION_KEYS);
  });

  it('juega el Desafío GNS: preguntas de una en una, sin soluciones, y lo aprueba', async () => {
    const base = `/me/training/modules/${moduleOf(CHALLENGE_MODULE).id}/challenge`;
    const seeds = INDUCTION_MODULES.find((module) => module.number === CHALLENGE_MODULE)?.questions;
    expect(seeds?.length).toBeGreaterThan(0);

    let step = (await teacher.call('post', base).send({}).expect(200)).body as ChallengeStep;
    const total = step.total;
    const seen = new Set<string>();
    for (let position = 1; ; position += 1) {
      expect(step.position).toBe(position);
      expect(JSON.stringify(step)).not.toMatch(SOLUTION_KEYS);
      seen.add(step.question.id);

      const seed = seeds?.find((question) => question.prompt === step.question.prompt);
      if (!seed) {
        throw new Error(`La pregunta «${step.question.prompt}» no está en los datos iniciales`);
      }
      const idOf = (text: string): string => {
        const option = step.question.options?.find((item) => item.text === text);
        if (!option) {
          throw new Error(`La opción «${text}» no llegó con la pregunta`);
        }
        return option.id;
      };
      let answer: Record<string, unknown>;
      if (seed.type === ChallengeQuestionType.TrueFalse) {
        answer = { value: seed.trueFalseAnswer };
      } else if (seed.type === ChallengeQuestionType.MultipleChoice) {
        answer = { optionId: idOf(seed.options?.find((option) => option.isCorrect)?.text ?? '') };
      } else {
        answer = { optionIds: (seed.options ?? []).map((option) => idOf(option.text)) };
      }

      const result = (
        await teacher
          .call('post', `${base}/answer`)
          .send({ questionId: step.question.id, answer })
          .expect(200)
      ).body as ChallengeAnswerResult;
      expect(result.correct).toBe(true);
      if (result.finished) {
        expect(result.result).toMatchObject({ score: 100, passed: true });
        break;
      }
      step = (await teacher.call('post', `${base}/next`).send({}).expect(200))
        .body as ChallengeStep;
    }
    expect(seen.size).toBe(total);
  });

  it('completa las actividades obligatorias del módulo 8', async () => {
    await loadRoute();
    const module = moduleOf(ACTIVITIES_MODULE);
    expect(module.completedAt).toBeNull();
    const activityId = (title: string): string => {
      const found = module.activities.find((activity) => activity.title === title);
      if (!found) {
        throw new Error(`No existe la actividad ${title} en la ruta`);
      }
      return found.id;
    };

    // Conecta: cada concepto se une con su dato (las fichas llegan con tokens opacos).
    const pairs = (seedActivity('Conecta').pares as { concepto: string; dato: string }[]).map(
      (pair) => [pair.concepto, pair.dato] as const,
    );
    const match = `/me/training/activities/${activityId('Conecta')}/game`;
    let matchStep = (await teacher.call('post', match).send({}).expect(200))
      .body as ActivityGameStep;
    while (matchStep.type === 'conecta' && !matchStep.finished) {
      const round = matchStep.round;
      if (!round) {
        throw new Error('La partida no entregó la ronda');
      }
      let last: ActivityGameAnswerResult | undefined;
      for (const concept of round.concepts) {
        const fact = pairs.find(([name]) => name === concept.concepto)?.[1];
        const factToken = round.facts.find((item) => item.dato === fact)?.token;
        expect(factToken).toBeDefined();
        last = (
          await teacher
            .call('post', `${match}/answer`)
            .send({ conceptToken: concept.token, factToken })
            .expect(200)
        ).body as ActivityGameAnswerResult;
      }
      if (last?.type === 'conecta' && last.finished) {
        expect(last.result?.passed).toBe(true);
        break;
      }
      matchStep = (await teacher.call('post', `${match}/next`).send({}).expect(200))
        .body as ActivityGameStep;
    }

    // ¿Verdad o mito?: cada afirmación se contesta según los datos sembrados.
    const statements = seedActivity('¿Verdad o mito?').afirmaciones as {
      texto: string;
      es_verdad: boolean;
    }[];
    const myth = `/me/training/activities/${activityId('¿Verdad o mito?')}/game`;
    let mythStep = (await teacher.call('post', myth).send({}).expect(200)).body as ActivityGameStep;
    while (mythStep.type === 'verdad_o_mito' && !mythStep.finished) {
      const statement = mythStep.statement;
      const value = statements.find((item) => item.texto === statement?.text)?.es_verdad;
      expect(value).toBeDefined();
      const result = (
        await teacher
          .call('post', `${myth}/answer`)
          .send({ position: statement?.position, value })
          .expect(200)
      ).body as ActivityGameAnswerResult;
      if (result.finished) {
        expect(result.type === 'verdad_o_mito' && result.result?.passed).toBe(true);
        break;
      }
      mythStep = (await teacher.call('post', `${myth}/next`).send({}).expect(200))
        .body as ActivityGameStep;
    }
  });

  it('termina los dos módulos y descarga el PDF de su certificado', async () => {
    await loadRoute();
    expect(moduleOf(CHALLENGE_MODULE).completedAt).not.toBeNull();
    expect(moduleOf(ACTIVITIES_MODULE).completedAt).not.toBeNull();

    const list = (await teacher.call('get', '/me/training/certificates').expect(200))
      .body as CertificateList;
    const forModule = list.items.filter((item) => item.kind === 'modulo');
    expect(forModule.length).toBeGreaterThanOrEqual(2);
    certificate = forModule.find((item) =>
      item.title.includes(moduleOf(CHALLENGE_MODULE).title),
    ) as CertificateSummary;
    expect(certificate).toBeDefined();

    const download = (
      await teacher.call('post', `/me/training/certificates/${certificate.id}/download`).expect(200)
    ).body as { url: string };
    delivered.push(JSON.stringify(download));
    const file = await fetch(download.url);
    const bytes = Buffer.from(await file.arrayBuffer());
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('application/pdf');
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('el código del certificado se verifica sin sesión y solo muestra lo que ya está en el PDF', async () => {
    const res = await request(serverOf(world.app))
      .get(`/certificates/verify/${certificate.code}`)
      .expect(200);
    const verification = res.body as CertificateVerification;

    expect(verification).toMatchObject({
      valid: true,
      teacherName: teacher.name,
      kind: 'modulo',
    });
    expect(Object.keys(verification).sort()).toEqual(
      ['issuedAt', 'kind', 'planName', 'teacherName', 'title', 'valid'].sort(),
    );
    await request(serverOf(world.app)).get('/certificates/verify/AAAA-AAAA-AAAA-AAAA').expect(404);
  });

  it('coordinación ve el avance en el seguimiento y lo exporta a CSV', async () => {
    const tracking = (
      await coordinator.call('get', `/training-tracking/plans/${planId}`).expect(200)
    ).body as PlanTracking;
    const row = tracking.teachers.find((item) => item.id === teacher.id);
    expect(row).toBeDefined();
    const stateOf = (number: string): TrackingModuleState | undefined => {
      const moduleId = tracking.modules.find((item) => item.number === number)?.id;
      return row?.modules.find((cell) => cell.moduleId === moduleId)?.state;
    };
    expect(stateOf(CHALLENGE_MODULE)).toBe(TrackingModuleState.Done);
    expect(stateOf(ACTIVITIES_MODULE)).toBe(TrackingModuleState.Done);

    const csv = await coordinator
      .call('get', `/training-tracking/plans/${planId}/export`)
      .expect(200);
    expect(csv.headers['content-type']).toMatch(/^text\/csv/);
    expect(csv.text).toContain(teacher.name);
    expect(csv.text).toContain('Terminado');
    expect(csv.text).not.toContain(certificate.code);
    world.expectNoSensitiveData(csv.text, []);
  });

  it('la bitácora registra el recorrido sin URL firmadas, claves de objeto ni tokens', async () => {
    const teacherRows = await world.auditRowsOf(coordinator, teacher.id);
    const coordinatorRows = await world.auditRowsOf(coordinator, coordinator.id);

    const milestones = teacherRows.filter((row) => row.type === AuditLogType.Training);
    expect(milestones.length).toBeGreaterThanOrEqual(6);
    expect(milestones.every((row) => row.role === UserRole.Teacher)).toBe(true);
    expect(teacherRows.some((row) => row.type === AuditLogType.DataConsent)).toBe(true);
    expect(coordinatorRows.some((row) => row.type === AuditLogType.Coordination)).toBe(true);

    const everything = [
      JSON.stringify([...teacherRows, ...coordinatorRows]),
      await world.auditCsvOf(coordinator, teacher.id),
      await world.auditCsvOf(coordinator, coordinator.id),
    ];
    for (const rows of everything) {
      world.expectNoSensitiveData(rows, [certificate.code]);
    }
    for (const row of milestones) {
      const detail = await coordinator.call('get', `/audit-log/${row.id}`).expect(200);
      world.expectNoSensitiveData(detail.text, [certificate.code]);
    }
    // Contraste: la URL firmada sí la recibe quien descarga el PDF, pero no la bitácora.
    expect(delivered[0]).toContain('X-Amz-');
  });
});
