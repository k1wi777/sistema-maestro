import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { TeacherAssignmentsService } from './teacher-assignments.service';

/**
 * Estado de la asignación para la bitácora: sus campos y los ids de sus relaciones, sin los
 * datos anidados del docente (el nombre no es parte de la asignación).
 */
@Injectable()
export class TeacherAssignmentAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly assignments: TeacherAssignmentsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const assignment = await this.assignments.find(id);
    if (!assignment) {
      return null;
    }
    return {
      id: assignment.id,
      teacherId: assignment.teacher.id,
      gradeId: assignment.grade.id,
      areaId: assignment.area.id,
      schoolYear: assignment.schoolYear,
      status: assignment.status,
      isHomeroomTeacher: assignment.isHomeroomTeacher,
    };
  }
}
