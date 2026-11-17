import { Inject, Injectable } from '@nestjs/common';
import type { AcademicStructure } from '@gns/shared';
import {
  CATALOG_USAGE_REPOSITORY,
  type CatalogUsageRepository,
} from '../catalogs/catalog-usage.repository';
import { SchoolYearsService } from '../school-years/school-years.service';
import {
  ACADEMIC_STRUCTURE_REPOSITORY,
  type AcademicStructureRepository,
} from './academic-structure.repository';

@Injectable()
export class AcademicStructureService {
  constructor(
    @Inject(ACADEMIC_STRUCTURE_REPOSITORY)
    private readonly repository: AcademicStructureRepository,
    @Inject(CATALOG_USAGE_REPOSITORY) private readonly usage: CatalogUsageRepository,
    private readonly schoolYears: SchoolYearsService,
  ) {}

  /** Sin año vigente la lectura no falla: no hay director de grupo y la página lo avisa. */
  async read(): Promise<AcademicStructure> {
    const current = await this.schoolYears.findCurrent();
    const [groups, grades, areas] = await Promise.all([
      this.usage.groupUsage(),
      this.usage.gradeUsage(),
      this.usage.areaUsage(),
    ]);
    return this.repository.read(current?.code ?? null, { groups, grades, areas });
  }
}
