import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnnotationStatus, JournalStatus, ReviewAction, UserRole, type Review } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { todayInBogota } from '../../../shared/time/bogota-time';
import type { GroupRoster } from '../../estructura/assignments/group-roster';
import type { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import type { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import type { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import { ReviewsService } from '../../planeacion/review/reviews.service';
import type { NewReview, ReviewRepository } from '../../planeacion/review/review.repository';
import type {
  AnnotationRow,
  FieldJournalRepository,
  JournalBase,
  NewAnnotation,
  ObservationRow,
  SubmissionRow,
} from './field-journal.repository';
import { FieldJournalsService } from './field-journals.service';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DIRECTOR = id(1);
const ANA = id(2);
const LUIS = id(3);
const COORD = id(4);
const ADMIN = id(5);
const OTHER_COORD = id(6);
const STRANGER = id(7);
const GROUP = id(10);
const GRADE = id(11);
const MATH = id(20);
const ART = id(21);
const SCIENCE = id(22);

const TODAY = todayInBogota();
const YEAR_NUMBER = Number(TODAY.slice(0, 4));
const YEAR = `${YEAR_NUMBER}-${YEAR_NUMBER + 1}`;

const user = (userId: string, role: UserRole): RequestUser => ({
  id: userId,
  role,
  sessionId: userId,
});
const director = user(DIRECTOR, UserRole.Teacher);
const ana = user(ANA, UserRole.Teacher);
const luis = user(LUIS, UserRole.Teacher);
const stranger = user(STRANGER, UserRole.Teacher);
const coordinator = user(COORD, UserRole.Coordinator);
const otherCoordinator = user(OTHER_COORD, UserRole.Coordinator);
const admin = user(ADMIN, UserRole.Administrator);

const NAMES: Record<string, string> = {
  [DIRECTOR]: 'Diego',
  [ANA]: 'Ana',
  [LUIS]: 'Luis',
  [COORD]: 'Elena',
  [ADMIN]: 'Administrador',
};

function makeRoster(options: { homeroom?: boolean; groupActive?: boolean } = {}): GroupRoster {
  const area = (areaId: string, name: string) => ({ id: areaId, name });
  return {
    group: { id: GROUP, name: 'Quinto 1', active: options.groupActive ?? true },
    grade: { id: GRADE, name: 'Quinto', active: true, coordinatorId: COORD },
    level: { id: id(12), name: 'Primaria' },
    homeroom: options.homeroom === false ? null : { id: DIRECTOR, fullName: 'Diego' },
    teachers: [
      { id: DIRECTOR, fullName: 'Diego', areas: [area(SCIENCE, 'Ciencias')] },
      { id: ANA, fullName: 'Ana', areas: [area(MATH, 'Matemáticas'), area(ART, 'Arte')] },
      { id: LUIS, fullName: 'Luis', areas: [area(ART, 'Arte')] },
    ],
  };
}

/** Repositorio en memoria: lo justo para ejercitar las reglas del servicio. */
function makeRepository(roster: GroupRoster) {
  let counter = 100;
  let journal: JournalBase | null = null;
  const annotations: AnnotationRow[] = [];
  const submissions: SubmissionRow[] = [];
  const observations: ObservationRow[] = [];
  const reviews: Review[] = [];
  const areaNames: Record<string, string> = {
    [MATH]: 'Matemáticas',
    [ART]: 'Arte',
    [SCIENCE]: 'Ciencias',
  };

  const repository = {
    findBase: jest.fn(() => Promise.resolve(journal)),
    findByKey: jest.fn(() =>
      Promise.resolve(
        journal && { id: journal.id, status: journal.status, schoolYear: journal.schoolYear },
      ),
    ),
    openOrCreate: jest.fn(
      (input: { groupId: string; date: string; schoolYear: string; createdById: string }) => {
        journal ??= {
          id: id(50),
          groupId: input.groupId,
          date: input.date,
          schoolYear: input.schoolYear,
          status: JournalStatus.InProgress,
          createdAt: new Date(),
          updatedAt: new Date(),
          submittedAt: null,
          voidedAt: null,
          createdBy: { id: input.createdById, fullName: NAMES[input.createdById] ?? 'X' },
          voidedBy: null,
          group: { id: GROUP, name: 'Quinto 1' },
          grade: { id: GRADE, name: 'Quinto', coordinatorId: COORD },
          level: { id: id(12), name: 'Primaria' },
        };
        return Promise.resolve({ id: journal.id, status: journal.status });
      },
    ),
    lock: jest.fn(() => Promise.resolve()),
    touch: jest.fn(() => Promise.resolve()),
    updateJournal: jest.fn(
      (_id: string, changes: Partial<JournalBase> & { voidedById?: string }) => {
        if (journal) {
          const { voidedById, ...rest } = changes;
          Object.assign(journal, rest);
          if (voidedById) {
            journal.voidedBy = { id: voidedById, fullName: NAMES[voidedById] ?? 'X' };
          }
        }
        return Promise.resolve();
      },
    ),
    findAnnotations: jest.fn((_journalId: string, viewerId: string) =>
      Promise.resolve(
        annotations.filter(
          (annotation) =>
            annotation.status !== AnnotationStatus.Draft || annotation.teacherId === viewerId,
        ),
      ),
    ),
    findAnnotation: jest.fn((_journalId: string, annotationId: string) =>
      Promise.resolve(annotations.find((annotation) => annotation.id === annotationId) ?? null),
    ),
    contributions: jest.fn(() => {
      const byTeacher = new Map<
        string,
        {
          teacherId: string;
          teacherName: string;
          ready: number;
          drafts: number;
          firstReadyAt: Date | null;
          areaNames: string[];
        }
      >();
      for (const annotation of annotations) {
        const row = byTeacher.get(annotation.teacherId) ?? {
          teacherId: annotation.teacherId,
          teacherName: annotation.teacherName,
          ready: 0,
          drafts: 0,
          firstReadyAt: null,
          areaNames: [],
        };
        if (annotation.status === AnnotationStatus.Draft) {
          row.drafts += 1;
        } else {
          row.ready += 1;
          row.firstReadyAt ??= annotation.readyAt;
          row.areaNames.push(annotation.areaName);
        }
        byTeacher.set(annotation.teacherId, row);
      }
      return Promise.resolve([...byTeacher.values()]);
    }),
    insertAnnotation: jest.fn((journalId: string, input: NewAnnotation) => {
      counter += 1;
      annotations.push({
        id: id(counter),
        journalId,
        teacherId: input.teacherId,
        teacherName: NAMES[input.teacherId] ?? 'X',
        areaId: input.areaId,
        areaName: areaNames[input.areaId] ?? 'Área',
        description: input.description,
        status: AnnotationStatus.Draft,
        readyAt: null,
        sent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return Promise.resolve();
    }),
    updateAnnotation: jest.fn((annotationId: string, content: Partial<AnnotationRow>) => {
      const target = annotations.find((annotation) => annotation.id === annotationId);
      if (target) {
        Object.assign(target, content);
      }
      return Promise.resolve();
    }),
    setAnnotationStatus: jest.fn(
      (annotationId: string, state: { status: AnnotationStatus; readyAt: Date | null }) => {
        const target = annotations.find((annotation) => annotation.id === annotationId);
        if (target) {
          target.status = state.status;
          target.readyAt = state.readyAt;
        }
        return Promise.resolve();
      },
    ),
    markReadySent: jest.fn(() => {
      for (const annotation of annotations) {
        if (annotation.status === AnnotationStatus.Ready) {
          annotation.sent = true;
        }
      }
      return Promise.resolve();
    }),
    markObserved: jest.fn((ids: string[]) => {
      for (const annotation of annotations) {
        if (ids.includes(annotation.id)) {
          annotation.status = AnnotationStatus.Observed;
        }
      }
      return Promise.resolve();
    }),
    insertSubmission: jest.fn(
      (input: Omit<SubmissionRow, 'id' | 'directorName'> & { journalId: string }) => {
        submissions.push({
          id: id(900 + submissions.length),
          directorId: input.directorId,
          directorName: NAMES[input.directorId] ?? 'X',
          submittedAt: input.submittedAt,
          resubmission: input.resubmission,
          readyCount: input.readyCount,
          expectedCount: input.expectedCount,
          missing: input.missing,
        });
        return Promise.resolve();
      },
    ),
    findSubmissions: jest.fn(() => Promise.resolve(submissions)),
    insertObservations: jest.fn(
      (reviewId: string, items: { annotationId: string; text: string }[]) => {
        for (const item of items) {
          observations.push({
            id: id(700 + observations.length),
            reviewId,
            annotationId: item.annotationId,
            text: item.text,
            reviewer: { id: COORD, fullName: 'Elena' },
            date: new Date(),
          });
        }
        return Promise.resolve();
      },
    ),
    findObservations: jest.fn(() => Promise.resolve(observations)),
    findUsers: jest.fn(() => Promise.resolve([])),
  };

  const reviewRepository: ReviewRepository = {
    insert: jest.fn((review: NewReview) => {
      const reviewId = id(800 + reviews.length);
      reviews.push({
        id: reviewId,
        action: review.action,
        comment: review.comment,
        reviewer: { id: review.reviewerId, fullName: NAMES[review.reviewerId] ?? 'X' },
        date: review.date,
        adjustedFields: [],
        changes: [],
      });
      return Promise.resolve(reviewId);
    }),
    findByRecord: jest.fn(() => Promise.resolve(reviews)),
  };

  const assignments = {
    groupRoster: jest.fn((groupId: string) => Promise.resolve(groupId === GROUP ? roster : null)),
    myGroups: jest.fn(() => Promise.resolve([])),
  };
  const schoolYears = {
    requireCurrent: jest.fn(() => Promise.resolve({ code: YEAR })),
    findCurrent: jest.fn(() => Promise.resolve({ code: YEAR })),
  };
  const periods = {
    list: jest.fn(() =>
      Promise.resolve({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 }),
    ),
  };
  const service = new FieldJournalsService(
    repository as unknown as FieldJournalRepository,
    assignments as unknown as TeacherAssignmentsService,
    schoolYears as unknown as SchoolYearsService,
    periods as unknown as AcademicPeriodsService,
    new ReviewsService(reviewRepository),
  );
  return { service, repository, annotations, submissions, reviews, periods };
}

const input = (patch: Record<string, unknown> = {}) => ({
  groupId: GROUP,
  date: TODAY,
  areaId: MATH,
  description: 'Texto de la anotación',
  ...patch,
});

type Setup = ReturnType<typeof makeRepository>;

/** Ana y Luis anotan, Ana marca lista; el diario queda En curso. */
async function withAnnotations(setup: Setup) {
  const created = await setup.service.addAnnotation(ana, input());
  await setup.service.addAnnotation(luis, input({ areaId: ART }));
  const anaAnnotation = setup.annotations.find((annotation) => annotation.teacherId === ANA)!;
  await setup.service.markReady(ana, created.id, anaAnnotation.id);
  return { journalId: created.id, anaAnnotation };
}

describe('FieldJournalsService · alta de anotaciones', () => {
  it('crea el diario con la primera anotación en borrador y la agrega al mismo después', async () => {
    const setup = makeRepository(makeRoster());
    const first = await setup.service.addAnnotation(ana, input());
    const second = await setup.service.addAnnotation(luis, input({ areaId: ART }));

    expect(first.status).toBe(JournalStatus.InProgress);
    expect(second.id).toBe(first.id);
    expect(setup.annotations).toHaveLength(2);
    expect(
      setup.annotations.every((annotation) => annotation.status === AnnotationStatus.Draft),
    ).toBe(true);
    expect(setup.repository.openOrCreate).toHaveBeenCalledTimes(2);
  });

  it('403 si no es participante del grupo y 404 si el grupo no existe', async () => {
    const setup = makeRepository(makeRoster());
    await expect(setup.service.addAnnotation(stranger, input())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      setup.service.addAnnotation(ana, input({ groupId: id(99) })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400 en `date` si es futura o anterior al año lectivo', async () => {
    const setup = makeRepository(makeRoster());
    await expect(
      setup.service.addAnnotation(ana, input({ date: `${YEAR_NUMBER + 2}-01-01` })),
    ).rejects.toMatchObject({
      fieldErrors: [{ field: 'date' }],
    });
    await expect(
      setup.service.addAnnotation(ana, input({ date: `${YEAR_NUMBER - 1}-12-31` })),
    ).rejects.toMatchObject({
      fieldErrors: [{ field: 'date' }],
    });
    expect(setup.repository.openOrCreate).not.toHaveBeenCalled();
  });

  it('usa el inicio del periodo 1 si está registrado', async () => {
    const setup = makeRepository(makeRoster());
    setup.periods.list.mockResolvedValueOnce({
      items: [{ number: 1, startDate: TODAY }],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    } as never);
    const before = `${YEAR_NUMBER}-01-01`;
    if (before < TODAY) {
      await expect(setup.service.addAnnotation(ana, input({ date: before }))).rejects.toMatchObject(
        {
          fieldErrors: [{ field: 'date' }],
        },
      );
    }
  });

  it('el encabezado trae el período que contiene la fecha, o nulo si ninguno la contiene', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    const periodList = (items: object[]) =>
      ({ items, page: 1, pageSize: 10, totalItems: items.length, totalPages: 1 }) as never;
    setup.periods.list.mockResolvedValue(
      periodList([
        { id: id(71), number: 1, startDate: '2000-01-01', endDate: '2000-03-31' },
        { id: id(72), number: 2, startDate: '2000-04-01', endDate: '2099-12-31' },
        { id: id(73), number: 3, startDate: null, endDate: null },
      ]),
    );
    expect((await setup.service.get(ana, journalId)).period).toEqual({ id: id(72), number: 2 });
    setup.periods.list.mockResolvedValue(
      periodList([{ id: id(71), number: 1, startDate: '2000-01-01', endDate: '2000-03-31' }]),
    );
    expect((await setup.service.get(ana, journalId)).period).toBeNull();
  });

  it('400 en `areaId` si no es una de sus asignaturas en el grupo', async () => {
    const setup = makeRepository(makeRoster());
    await expect(setup.service.addAnnotation(luis, input({ areaId: MATH }))).rejects.toMatchObject({
      fieldErrors: [{ field: 'areaId' }],
    });
  });

  it('400 en `groupId` si el grupo está inactivo y el diario aún no existe', async () => {
    const setup = makeRepository(makeRoster({ groupActive: false }));
    await expect(setup.service.addAnnotation(ana, input())).rejects.toMatchObject({
      fieldErrors: [{ field: 'groupId' }],
    });
  });

  it('409 si el diario ya no está En curso', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await setup.service.submit(director, journalId);
    await expect(setup.service.addAnnotation(ana, input())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('FieldJournalsService · anotaciones propias', () => {
  it('solo el autor edita, marca lista y devuelve a borrador (403 a los demás)', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId, anaAnnotation } = await withAnnotations(setup);

    await expect(
      setup.service.updateAnnotation(luis, journalId, anaAnnotation.id, { description: 'Hackeo' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await setup.service.updateAnnotation(ana, journalId, anaAnnotation.id, {
      description: 'Nuevo',
    });
    // Editar una lista la mantiene lista y conserva su hora.
    const readyAt = setup.annotations.find((a) => a.id === anaAnnotation.id)!.readyAt;
    expect(anaAnnotation.status).toBe(AnnotationStatus.Ready);
    await setup.service.markReady(ana, journalId, anaAnnotation.id);
    expect(anaAnnotation.readyAt).toBe(readyAt);
    await setup.service.markDraft(ana, journalId, anaAnnotation.id);
    expect(anaAnnotation.status).toBe(AnnotationStatus.Draft);
  });

  it('nadie ve los borradores de otro: 404 al intentar tocarlos', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    const lusDraft = setup.annotations.find((annotation) => annotation.teacherId === LUIS)!;
    await expect(
      setup.service.updateAnnotation(ana, journalId, lusDraft.id, { description: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    const detail = await setup.service.get(ana, journalId);
    expect(detail.annotations.map((annotation) => annotation.teacher.id)).toEqual([ANA]);
  });

  it('con el diario enviado, todo es 409', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId, anaAnnotation } = await withAnnotations(setup);
    await setup.service.submit(director, journalId);
    await expect(
      setup.service.updateAnnotation(ana, journalId, anaAnnotation.id, { description: 'Tarde' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(setup.service.markDraft(ana, journalId, anaAnnotation.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('FieldJournalsService · envío del director(a)', () => {
  it('envía con n de m congelado y conserva quién faltó y por qué', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    const detail = await setup.service.submit(director, journalId);

    expect(detail.status).toBe(JournalStatus.Submitted);
    expect(setup.submissions).toEqual([
      expect.objectContaining({
        readyCount: 1,
        expectedCount: 3,
        resubmission: false,
        missing: [
          { teacherId: DIRECTOR, status: 'sin_aporte' },
          { teacherId: LUIS, status: 'borrador' },
        ],
      }),
    ]);
    expect(detail.readyCount).toBe(1);
    expect(detail.expectedCount).toBe(3);
    expect(detail.missing.map((entry) => [entry.teacher.fullName, entry.status])).toEqual([
      ['Diego', 'none'],
      ['Luis', 'draft'],
    ]);
    // Los borradores no viajan y no se borran.
    expect(setup.annotations.find((a) => a.teacherId === LUIS)).toMatchObject({
      status: AnnotationStatus.Draft,
      sent: false,
    });
  });

  it('403 a quien no dirige, 409 sin director(a) o fuera de En curso y 400 sin anotaciones listas', async () => {
    const withoutDirector = makeRepository(makeRoster({ homeroom: false }));
    const { journalId: noDirectorJournal } = await withAnnotations(withoutDirector);
    await expect(
      withoutDirector.service.submit(director, noDirectorJournal),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      (await withoutDirector.service.get(ana, noDirectorJournal)).viewer.blockedReason,
    ).toMatch(/director/);

    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await expect(setup.service.submit(ana, journalId)).rejects.toBeInstanceOf(ForbiddenException);
    await setup.service.submit(director, journalId);
    await expect(setup.service.submit(director, journalId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const empty = makeRepository(makeRoster());
    const created = await empty.service.addAnnotation(ana, input());
    await expect(empty.service.submit(director, created.id)).rejects.toMatchObject({
      fieldErrors: [{ field: 'annotations' }],
    });
  });

  it('el director(a) anula En curso con 409 si ya está enviado y nadie más anula', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await expect(setup.service.voidJournal(ana, journalId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(setup.service.voidJournal(admin, journalId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const voided = await setup.service.voidJournal(director, journalId);
    expect(voided.status).toBe(JournalStatus.Voided);
    await expect(setup.service.voidJournal(director, journalId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('FieldJournalsService · revisión', () => {
  async function submitted() {
    const setup = makeRepository(makeRoster());
    const flow = await withAnnotations(setup);
    await setup.service.submit(director, flow.journalId);
    return { setup, ...flow };
  }

  it('la coordinadora del grado devuelve con observaciones y solo el autor corrige', async () => {
    const { setup, journalId, anaAnnotation } = await submitted();
    const returned = await setup.service.returnJournal(coordinator, journalId, {
      comment: 'Revisen',
      observations: [{ annotationId: anaAnnotation.id, text: 'Amplía la descripción' }],
    });

    expect(returned.status).toBe(JournalStatus.ChangesRequested);
    expect(setup.reviews.at(-1)?.action).toBe(ReviewAction.ChangesRequested);
    expect(anaAnnotation.status).toBe(AnnotationStatus.Observed);
    // Visibilidad (R17): su autora, el director(a) y coordinación la ven; Luis no.
    const forAna = await setup.service.get(ana, journalId);
    expect(forAna.annotations.find((a) => a.isMine)?.observation?.text).toBe(
      'Amplía la descripción',
    );
    expect(forAna.generalObservation).toBeNull();
    const forLuis = await setup.service.get(luis, journalId);
    expect(forLuis.annotations.every((a) => a.observation === null)).toBe(true);
    const forDirector = await setup.service.get(director, journalId);
    expect(forDirector.generalObservation?.text).toBe('Revisen');
    expect(forDirector.viewer.canResubmit).toBe(false);
    expect(forDirector.viewer.blockedReason).toMatch(/Ana/);

    await expect(setup.service.addAnnotation(luis, input({ areaId: ART }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      setup.service.updateAnnotation(
        luis,
        journalId,
        setup.annotations.find((a) => a.teacherId === LUIS)!.id,
        { description: 'X' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await setup.service.updateAnnotation(ana, journalId, anaAnnotation.id, {
      description: 'Corregida',
    });
    await setup.service.markReady(ana, journalId, anaAnnotation.id);
    expect(anaAnnotation.status).toBe(AnnotationStatus.Ready);
  });

  it('el reenvío exige corregir las observadas y recalcula el n de m', async () => {
    const { setup, journalId, anaAnnotation } = await submitted();
    await setup.service.returnJournal(coordinator, journalId, {
      observations: [{ annotationId: anaAnnotation.id, text: 'Falta contexto' }],
    });
    await expect(setup.service.resubmit(director, journalId)).rejects.toMatchObject({
      fieldErrors: [{ field: 'annotations', reason: expect.stringContaining('Ana') as string }],
    });
    await setup.service.markReady(ana, journalId, anaAnnotation.id);
    const resent = await setup.service.resubmit(director, journalId);

    expect(resent.status).toBe(JournalStatus.Submitted);
    expect(setup.submissions).toHaveLength(2);
    expect(setup.submissions[1]).toMatchObject({
      resubmission: true,
      readyCount: 1,
      expectedCount: 3,
    });
    expect(resent.history.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['opened', 'ready', 'submitted', 'returned', 'resubmitted']),
    );
    expect(JSON.stringify(resent.history)).not.toContain('Falta contexto');
  });

  it('aprueba con la firma y la aprobación es de la coordinadora del grado o de administración', async () => {
    const { setup, journalId } = await submitted();
    await expect(setup.service.approve(otherCoordinator, journalId, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const approved = await setup.service.approve(admin, journalId, { comment: 'Gracias' });
    expect(approved.status).toBe(JournalStatus.Reviewed);
    expect(approved.signature?.reviewer.id).toBe(ADMIN);
    await expect(setup.service.approve(coordinator, journalId, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('409 si el diario no está enviado y 400 si la observación no es de una anotación enviada', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await expect(setup.service.approve(coordinator, journalId, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    await setup.service.submit(director, journalId);
    const draft = setup.annotations.find((annotation) => annotation.teacherId === LUIS)!;
    await expect(
      setup.service.returnJournal(coordinator, journalId, {
        observations: [{ annotationId: draft.id, text: 'No enviada' }],
      }),
    ).rejects.toMatchObject({ fieldErrors: [{ field: 'observations.0.annotationId' }] });
  });

  it('403 de autorrevisión si quien revisa es director(a) o autor de una anotación enviada', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await setup.service.submit(director, journalId);
    const selfReviewer = user(ANA, UserRole.Coordinator);
    selfReviewer.role = UserRole.Administrator;
    await expect(setup.service.approve(selfReviewer, journalId, {})).rejects.toMatchObject({
      status: 403,
    });
    const directorAsAdmin = user(DIRECTOR, UserRole.Administrator);
    await expect(setup.service.approve(directorAsAdmin, journalId, {})).rejects.toMatchObject({
      status: 403,
    });
  });

  it('la coordinadora no ve diarios sin enviar, y administración sí', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await expect(setup.service.get(coordinator, journalId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(setup.service.get(admin, journalId)).resolves.toBeDefined();
    await setup.service.submit(director, journalId);
    const forCoordinator = await setup.service.get(coordinator, journalId);
    expect(forCoordinator.viewer.canReview).toBe(true);
    // Nunca borradores ajenos: solo las anotaciones listas.
    expect(forCoordinator.annotations).toHaveLength(1);
  });
});

describe('FieldJournalsService · vista del día', () => {
  it('sin diario devuelve el encabezado vacío para el participante y 403 al ajeno', async () => {
    const setup = makeRepository(makeRoster());
    const day = await setup.service.day(ana, GROUP, TODAY);
    expect(day.id).toBeNull();
    expect(day.viewer).toMatchObject({ isParticipant: true, canAnnotate: true, canSubmit: false });
    expect(day.viewer.areas.map((area) => area.name)).toEqual(['Matemáticas', 'Arte']);
    await expect(setup.service.day(stranger, GROUP, TODAY)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('el director(a) ve el aporte de cada docente; los demás participantes no', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    const forDirector = await setup.service.get(director, journalId);
    expect(forDirector.contributors.map((entry) => [entry.teacher.fullName, entry.status])).toEqual(
      [
        ['Diego', 'none'],
        ['Ana', 'ready'],
        ['Luis', 'draft'],
      ],
    );
    expect(forDirector.viewer).toMatchObject({
      isHomeroomTeacher: true,
      canSubmit: true,
      canVoid: true,
    });
    expect(forDirector.readyCount).toBe(1);
    expect(forDirector.expectedCount).toBe(3);
    const forLuis = await setup.service.get(luis, journalId);
    expect(forLuis.contributors).toEqual([]);
  });

  it('un extraño no ve el diario por id', async () => {
    const setup = makeRepository(makeRoster());
    const { journalId } = await withAnnotations(setup);
    await expect(setup.service.get(stranger, journalId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
