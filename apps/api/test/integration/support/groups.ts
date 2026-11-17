import type { PrismaService } from '../../../src/shared/database/prisma.service';

/** Grupo «<grado> 1» del grado (se crea si no existe): las asignaciones de prueba son por grupo. */
export async function groupOfGrade(prisma: PrismaService, gradeId: string): Promise<string> {
  const grade = await prisma.grade.findUniqueOrThrow({ where: { id: gradeId } });
  const name = `${grade.name} 1`;
  const group = await prisma.group.upsert({
    where: { gradeId_name: { gradeId, name } },
    create: { gradeId, name },
    update: {},
  });
  return group.id;
}
