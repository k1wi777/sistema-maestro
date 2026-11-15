-- FE-2 · Repositorio: grado, rincón y tipo de la actividad compartida.
-- Solo añade columnas: no borra ni reescribe filas. Las actividades existentes quedan con
-- `tipo = 'actividad'` (DEFAULT), sin grado y sin rincón. Los privilegios de `app_gns` son por
-- tabla y no cambian.

-- AlterTable
ALTER TABLE "actividad_repositorio" ADD COLUMN     "grado_id" UUID,
ADD COLUMN     "rincon" VARCHAR(60),
ADD COLUMN     "tipo" VARCHAR(20) NOT NULL DEFAULT 'actividad';

-- CreateIndex
CREATE INDEX "actividad_repositorio_grado_id_idx" ON "actividad_repositorio"("grado_id");

-- AddForeignKey
ALTER TABLE "actividad_repositorio" ADD CONSTRAINT "actividad_repositorio_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restricción CHECK (Prisma no la modela; nombre <tabla>_<columna>_check). Los valores de `tipo`
-- son los de `SharedActivityType` en @gns/shared.
ALTER TABLE "actividad_repositorio"
  ADD CONSTRAINT actividad_repositorio_tipo_check
    CHECK (tipo IN ('actividad', 'juego', 'proyecto', 'recurso_digital', 'video'));
