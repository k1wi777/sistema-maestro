-- AlterTable
ALTER TABLE "actividad_modulo" ADD COLUMN     "instrucciones" VARCHAR(500);

-- AlterTable
ALTER TABLE "modulo_formacion" ADD COLUMN     "segundos_por_pregunta" SMALLINT,
ADD COLUMN     "umbral_aprobacion" SMALLINT NOT NULL DEFAULT 80,
ADD COLUMN     "video_titulo" VARCHAR(160);

-- BE-1 (#8) · Restricciones CHECK de los ajustes del modelo de formación.
-- Prisma no modela CHECK: nombres <tabla>_<columna>_check. Los valores deben
-- coincidir con las constantes de @gns/shared; las pruebas de base de datos lo
-- comprueban.

-- Se añade `borrador` (módulo aún no publicado); las filas existentes no cambian.
ALTER TABLE modulo_formacion
  DROP CONSTRAINT modulo_formacion_estado_check,
  ADD CONSTRAINT modulo_formacion_estado_check
    CHECK (estado IN ('borrador', 'activo', 'fuera_del_plan')),
  ADD CONSTRAINT modulo_formacion_umbral_aprobacion_check
    CHECK (umbral_aprobacion BETWEEN 0 AND 100),
  ADD CONSTRAINT modulo_formacion_segundos_por_pregunta_check
    CHECK (segundos_por_pregunta IS NULL OR segundos_por_pregunta BETWEEN 5 AND 120);
