import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { TrainingModule, TrainingPlan, TrainingSection } from '@gns/shared';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { AreasService } from '../../estructura/catalogs/area/areas.service';
import type { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import type { TrainingPlanRepository } from './training-plan.repository';
import { TrainingPlansService } from './training-plans.service';

const NOW = new Date('2026-11-09T10:00:00.000Z');
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const plan = (change: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: ID(1),
  areaId: null,
  name: 'General',
  schoolYear: '2026-2027',
  createdAt: NOW,
  updatedAt: NOW,
  ...change,
});
const section = (change: Partial<TrainingSection> = {}): TrainingSection => ({
  id: ID(2),
  planId: ID(1),
  title: 'Parte I',
  subtitle: null,
  sortOrder: 1,
  createdAt: NOW,
  updatedAt: NOW,
  ...change,
});
const trainingModule = (change: Partial<TrainingModule> = {}): TrainingModule => ({
  id: ID(3),
  planId: ID(1),
  sectionId: ID(2),
  number: '1',
  sortOrder: 1,
  title: 'Módulo',
  summary: null,
  videoUrl: null,
  videoTitle: null,
  presentationUrl: null,
  videoSource: null,
  videoEmbedUrl: null,
  videoFile: null,
  presentationFile: null,
  status: 'borrador',
  approvalThreshold: 80,
  secondsPerQuestion: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...change,
});

function setup() {
  const repository = {
    findPlan: jest.fn(),
    findPlanByAreaAndYear: jest.fn().mockResolvedValue(null),
    lockPlanCreation: jest.fn().mockResolvedValue(undefined),
    lockPlan: jest.fn().mockResolvedValue(undefined),
    createPlan: jest.fn().mockResolvedValue(plan()),
    updatePlan: jest.fn().mockResolvedValue(plan()),
    findSection: jest.fn(),
    lockSection: jest.fn().mockResolvedValue(undefined),
    createSection: jest.fn(),
    deleteSection: jest.fn().mockResolvedValue(undefined),
    countModulesInSection: jest.fn().mockResolvedValue(0),
    listSectionIds: jest.fn(),
    setSectionOrder: jest.fn().mockResolvedValue(undefined),
    listSectionsWithModules: jest.fn().mockResolvedValue([]),
    findModule: jest.fn(),
    lockModule: jest.fn().mockResolvedValue(undefined),
    updateModule: jest.fn().mockResolvedValue(trainingModule()),
    moveModule: jest.fn().mockResolvedValue(trainingModule({ sectionId: ID(9) })),
    listModuleIds: jest.fn(),
    setModuleOrder: jest.fn().mockResolvedValue(undefined),
    setModuleStatus: jest.fn(),
    countContent: jest.fn().mockResolvedValue({ slides: 0, questions: 0, activeActivities: 0 }),
  };
  const areas = { find: jest.fn().mockResolvedValue({ id: ID(80) }) };
  const schoolYears = { findByCode: jest.fn().mockResolvedValue({ code: '2026-2027' }) };
  const transactions: TransactionRunner = { run: (fn) => fn() };
  const service = new TrainingPlansService(
    repository as unknown as TrainingPlanRepository,
    transactions,
    areas as unknown as AreasService,
    schoolYears as unknown as SchoolYearsService,
  );
  return { service, repository, areas, schoolYears };
}

describe('TrainingPlansService plans', () => {
  it('creates a plan after taking the creation lock', async () => {
    const { service, repository } = setup();

    await service.createPlan({ name: 'General', areaId: null, schoolYear: '2026-2027' });

    expect(repository.lockPlanCreation.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createPlan.mock.invocationCallOrder[0] as number,
    );
  });

  it('answers 409 when the area and year already have a plan', async () => {
    const { service, repository } = setup();
    repository.findPlanByAreaAndYear.mockResolvedValue(plan({ id: ID(7) }));

    await expect(
      service.createPlan({ name: 'Otro', areaId: null, schoolYear: '2026-2027' }),
    ).rejects.toThrow(ConflictException);
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('answers 409 when an edit moves a plan to a taken year but not for itself', async () => {
    const { service, repository } = setup();
    repository.findPlan.mockResolvedValue(plan());
    repository.findPlanByAreaAndYear.mockResolvedValue(plan({ id: ID(7) }));

    await expect(service.updatePlan(ID(1), { schoolYear: '2027-2028' })).rejects.toThrow(
      ConflictException,
    );

    repository.findPlanByAreaAndYear.mockResolvedValue(plan());
    await expect(service.updatePlan(ID(1), { schoolYear: '2027-2028' })).resolves.toBeDefined();
  });

  it.each([
    ['unknown area', (s: ReturnType<typeof setup>) => s.areas.find.mockResolvedValue(null)],
    [
      'unknown school year',
      (s: ReturnType<typeof setup>) => s.schoolYears.findByCode.mockResolvedValue(null),
    ],
  ])('rejects a plan with an %s with 400', async (_name, arrange) => {
    const ctx = setup();
    arrange(ctx);

    await expect(
      ctx.service.createPlan({ name: 'x', areaId: ID(80), schoolYear: '2026-2027' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('answers 404 for a plan that does not exist', async () => {
    const { service, repository } = setup();
    repository.findPlan.mockResolvedValue(null);

    await expect(service.tree(ID(1))).rejects.toThrow(NotFoundException);
  });
});

describe('TrainingPlansService sections', () => {
  it('refuses to remove a section that has modules', async () => {
    const { service, repository } = setup();
    repository.findSection.mockResolvedValue(section());
    repository.countModulesInSection.mockResolvedValue(2);

    await expect(service.deleteSection(ID(2))).rejects.toThrow(ConflictException);
    expect(repository.deleteSection).not.toHaveBeenCalled();
  });

  it('removes an empty section', async () => {
    const { service, repository } = setup();
    repository.findSection.mockResolvedValue(section());

    await service.deleteSection(ID(2));

    expect(repository.deleteSection).toHaveBeenCalledWith(ID(2));
  });

  it('renumbers only with the complete list and answers 409 otherwise', async () => {
    const { service, repository } = setup();
    repository.findPlan.mockResolvedValue(plan());
    repository.listSectionIds.mockResolvedValue([ID(2), ID(3)]);

    await expect(service.setSectionOrder(ID(1), [ID(3), ID(2)])).resolves.toBeDefined();
    expect(repository.setSectionOrder).toHaveBeenCalledWith([ID(3), ID(2)]);

    repository.setSectionOrder.mockClear();
    await expect(service.setSectionOrder(ID(1), [ID(2)])).rejects.toThrow(ConflictException);
    await expect(service.setSectionOrder(ID(1), [ID(2), ID(2)])).rejects.toThrow(ConflictException);
    await expect(service.setSectionOrder(ID(1), [ID(2), ID(4)])).rejects.toThrow(ConflictException);
    expect(repository.setSectionOrder).not.toHaveBeenCalled();
  });

  it('answers 409 to a module order that misses a module added meanwhile', async () => {
    const { service, repository } = setup();
    repository.findSection.mockResolvedValue(section());
    repository.listModuleIds.mockResolvedValue([ID(3), ID(4)]);

    await expect(service.setModuleOrder(ID(2), [ID(3)])).rejects.toThrow(ConflictException);
  });
});

describe('TrainingPlansService modules', () => {
  it('moves a module to a section of the same plan, locking both sections', async () => {
    const { service, repository } = setup();
    repository.findModule.mockResolvedValue(trainingModule());
    repository.findSection.mockResolvedValue(section({ id: ID(9), planId: ID(1) }));

    await service.updateModule(ID(3), { sectionId: ID(9), title: 'Nuevo' });

    expect(repository.lockSection).toHaveBeenCalledWith(ID(2));
    expect(repository.lockSection).toHaveBeenCalledWith(ID(9));
    expect(repository.moveModule).toHaveBeenCalledWith(ID(3), ID(9));
    expect(repository.updateModule).toHaveBeenCalledWith(ID(3), { title: 'Nuevo' });
  });

  it('answers 400 and moves nothing when the section belongs to another plan', async () => {
    const { service, repository } = setup();
    repository.findModule.mockResolvedValue(trainingModule());
    repository.findSection.mockResolvedValue(section({ id: ID(9), planId: ID(77) }));

    await expect(service.updateModule(ID(3), { sectionId: ID(9) })).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.moveModule).not.toHaveBeenCalled();
    expect(repository.updateModule).not.toHaveBeenCalled();
  });

  it.each([
    ['publish', 'borrador', 'activo'],
    ['withdraw', 'activo', 'fuera_del_plan'],
    ['restore', 'fuera_del_plan', 'activo'],
  ] as const)('applies %s from %s to %s', async (action, from, to) => {
    const { service, repository } = setup();
    repository.findModule.mockResolvedValue(
      trainingModule({ status: from, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
    );
    repository.setModuleStatus.mockResolvedValue(trainingModule({ status: to }));

    await service.changeStatus(ID(3), action);

    expect(repository.setModuleStatus).toHaveBeenCalledWith(ID(3), to);
  });

  it.each([
    ['publish', 'activo'],
    ['publish', 'fuera_del_plan'],
    ['withdraw', 'borrador'],
    ['withdraw', 'fuera_del_plan'],
    ['restore', 'borrador'],
    ['restore', 'activo'],
  ] as const)('answers 409 to %s from %s', async (action, from) => {
    const { service, repository } = setup();
    repository.findModule.mockResolvedValue(trainingModule({ status: from }));

    await expect(service.changeStatus(ID(3), action)).rejects.toThrow(ConflictException);
    expect(repository.setModuleStatus).not.toHaveBeenCalled();
  });

  it('refuses to publish a module with no required step', async () => {
    const { service, repository } = setup();
    repository.findModule.mockResolvedValue(trainingModule());

    await expect(service.changeStatus(ID(3), 'publish')).rejects.toThrow(ConflictException);
  });

  it.each([
    [
      'a video',
      trainingModule({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
      { slides: 0, questions: 0, activeActivities: 0 },
    ],
    [
      'a presentation link',
      trainingModule({ presentationUrl: 'https://gns.test/p' }),
      { slides: 0, questions: 0, activeActivities: 0 },
    ],
    ['a slide', trainingModule(), { slides: 1, questions: 0, activeActivities: 0 }],
    ['a question', trainingModule(), { slides: 0, questions: 1, activeActivities: 0 }],
    ['an active activity', trainingModule(), { slides: 0, questions: 0, activeActivities: 1 }],
  ])('publishes a module that has %s', async (_name, found, counts) => {
    const { service, repository } = setup();
    repository.findModule.mockResolvedValue(found);
    repository.countContent.mockResolvedValue(counts);
    repository.setModuleStatus.mockResolvedValue(trainingModule({ status: 'activo' }));

    await expect(service.changeStatus(ID(3), 'publish')).resolves.toMatchObject({
      status: 'activo',
    });
  });
});
