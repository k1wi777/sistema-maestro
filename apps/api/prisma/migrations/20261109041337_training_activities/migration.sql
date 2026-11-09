-- CreateTable
CREATE TABLE "actividad_modulo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modulo_id" UUID NOT NULL,
    "tipo" VARCHAR(16) NOT NULL,
    "orden" SMALLINT NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "obligatoria" BOOLEAN NOT NULL,
    "estado" VARCHAR(14) NOT NULL,
    "configuracion" JSONB NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso_actividad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "actividad_id" UUID NOT NULL,
    "completada_en" TIMESTAMPTZ(6),
    "mejor_puntaje" SMALLINT,
    "mejores_puntos" INTEGER,
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "detalle" JSONB,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progreso_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actividad_modulo_modulo_id_idx" ON "actividad_modulo"("modulo_id");

-- CreateIndex
CREATE INDEX "progreso_actividad_docente_id_idx" ON "progreso_actividad"("docente_id");

-- CreateIndex
CREATE INDEX "progreso_actividad_actividad_id_idx" ON "progreso_actividad"("actividad_id");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_actividad_docente_id_actividad_id_key" ON "progreso_actividad"("docente_id", "actividad_id");

-- AddForeignKey
ALTER TABLE "actividad_modulo" ADD CONSTRAINT "actividad_modulo_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulo_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "progreso_actividad" ADD CONSTRAINT "progreso_actividad_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "progreso_actividad" ADD CONSTRAINT "progreso_actividad_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividad_modulo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- BE-14 a BE-17 · Restricciones CHECK de las actividades de módulo.
-- Prisma no modela CHECK: se declaran aquí con el nombre <tabla>_<columna>_check.
-- Los valores de tipo y estado deben coincidir con @gns/shared (TrainingActivityType
-- y TrainingModuleStatus); las pruebas de base de datos lo comprueban. El contenido
-- de configuracion y detalle lo valida Zod por tipo; la base solo exige un objeto.
ALTER TABLE actividad_modulo
  ADD CONSTRAINT actividad_modulo_tipo_check
    CHECK (tipo IN ('ruleta_pasaporte', 'conecta', 'verdad_o_mito', 'simulador')),
  ADD CONSTRAINT actividad_modulo_estado_check CHECK (estado IN ('activo', 'fuera_del_plan')),
  ADD CONSTRAINT actividad_modulo_configuracion_check
    CHECK (jsonb_typeof(configuracion) = 'object');

ALTER TABLE progreso_actividad
  ADD CONSTRAINT progreso_actividad_mejor_puntaje_check
    CHECK (mejor_puntaje IS NULL OR mejor_puntaje BETWEEN 0 AND 100),
  ADD CONSTRAINT progreso_actividad_intentos_check CHECK (intentos >= 0);
