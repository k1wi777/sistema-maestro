-- Diario de campo colaborativo por grupo y por día (#107). En una sola transacción: los diarios
-- por docente y periodo actuales se archivan (renombrados a *_historico, con sus restricciones
-- y su historial de revisión y bitácora intactos, y de solo lectura para la aplicación) y nacen
-- el diario por grupo y fecha, sus anotaciones, sus envíos y las observaciones de coordinación.
-- No se borra ni se convierte ninguna fila: el grupo y la asignatura no existen en los diarios
-- anteriores y habría que inventarlos.

-- ---------- Archivo: tablas actuales -> histórico ----------

ALTER TABLE "diario_campo" RENAME TO "diario_campo_historico";
ALTER TABLE "diario_entrada" RENAME TO "diario_entrada_historico";

ALTER TABLE "diario_campo_historico" RENAME CONSTRAINT "diario_campo_pkey" TO "diario_campo_historico_pkey";
ALTER TABLE "diario_campo_historico" RENAME CONSTRAINT "diario_campo_docente_id_fkey" TO "diario_campo_historico_docente_id_fkey";
ALTER TABLE "diario_campo_historico" RENAME CONSTRAINT "diario_campo_grado_id_fkey" TO "diario_campo_historico_grado_id_fkey";
ALTER TABLE "diario_campo_historico" RENAME CONSTRAINT "diario_campo_periodo_id_fkey" TO "diario_campo_historico_periodo_id_fkey";
ALTER TABLE "diario_campo_historico" RENAME CONSTRAINT "diario_campo_estado_check" TO "diario_campo_historico_estado_check";
ALTER INDEX "diario_campo_docente_id_idx" RENAME TO "diario_campo_historico_docente_id_idx";
ALTER INDEX "diario_campo_grado_id_idx" RENAME TO "diario_campo_historico_grado_id_idx";
ALTER INDEX "diario_campo_periodo_id_idx" RENAME TO "diario_campo_historico_periodo_id_idx";
ALTER INDEX "diario_campo_docente_id_grado_id_periodo_id_key" RENAME TO "diario_campo_historico_docente_id_grado_id_periodo_id_key";

ALTER TABLE "diario_entrada_historico" RENAME CONSTRAINT "diario_entrada_pkey" TO "diario_entrada_historico_pkey";
ALTER TABLE "diario_entrada_historico" RENAME CONSTRAINT "diario_entrada_diario_id_fkey" TO "diario_entrada_historico_diario_id_fkey";
ALTER TABLE "diario_entrada_historico" RENAME CONSTRAINT "diario_entrada_tipo_evento_check" TO "diario_entrada_historico_tipo_evento_check";
ALTER INDEX "diario_entrada_diario_id_idx" RENAME TO "diario_entrada_historico_diario_id_idx";

-- Solo lectura para la aplicación: sin API ni pantalla que los modifique.
REVOKE INSERT, UPDATE, DELETE ON "diario_campo_historico", "diario_entrada_historico" FROM app_gns;

-- ---------- Diario por grupo y fecha ----------

-- CreateTable
CREATE TABLE "diario_campo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "anio_lectivo" VARCHAR(9) NOT NULL,
    "estado" VARCHAR(14) NOT NULL,
    "creado_por" UUID NOT NULL,
    "enviado_en" TIMESTAMPTZ(6),
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_campo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_anotacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "diario_id" UUID NOT NULL,
    "docente_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "tipo_evento" VARCHAR(10) NOT NULL,
    "estudiantes" VARCHAR(160),
    "descripcion" TEXT NOT NULL,
    "acciones" TEXT,
    "reflexion" TEXT,
    "estado" VARCHAR(10) NOT NULL,
    "lista_en" TIMESTAMPTZ(6),
    "enviada" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_anotacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_envio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "diario_id" UUID NOT NULL,
    "director_id" UUID NOT NULL,
    "enviado_en" TIMESTAMPTZ(6) NOT NULL,
    "reenvio" BOOLEAN NOT NULL,
    "aportes_listos" SMALLINT NOT NULL,
    "docentes_esperados" SMALLINT NOT NULL,
    "faltantes" JSONB NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_observacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "revision_id" UUID NOT NULL,
    "anotacion_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_observacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diario_campo_grupo_id_idx" ON "diario_campo"("grupo_id");

-- CreateIndex
CREATE INDEX "diario_campo_fecha_idx" ON "diario_campo"("fecha");

-- CreateIndex
CREATE INDEX "diario_campo_estado_idx" ON "diario_campo"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "diario_campo_grupo_id_fecha_key" ON "diario_campo"("grupo_id", "fecha");

-- CreateIndex
CREATE INDEX "diario_anotacion_diario_id_idx" ON "diario_anotacion"("diario_id");

-- CreateIndex
CREATE INDEX "diario_anotacion_docente_id_idx" ON "diario_anotacion"("docente_id");

-- CreateIndex
CREATE INDEX "diario_anotacion_area_id_idx" ON "diario_anotacion"("area_id");

-- CreateIndex
CREATE INDEX "diario_envio_diario_id_idx" ON "diario_envio"("diario_id");

-- CreateIndex
CREATE INDEX "diario_envio_director_id_idx" ON "diario_envio"("director_id");

-- CreateIndex
CREATE INDEX "diario_observacion_revision_id_idx" ON "diario_observacion"("revision_id");

-- CreateIndex
CREATE INDEX "diario_observacion_anotacion_id_idx" ON "diario_observacion"("anotacion_id");

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_anio_lectivo_fkey" FOREIGN KEY ("anio_lectivo") REFERENCES "anio_lectivo"("codigo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_anotacion" ADD CONSTRAINT "diario_anotacion_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_campo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_anotacion" ADD CONSTRAINT "diario_anotacion_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_anotacion" ADD CONSTRAINT "diario_anotacion_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_envio" ADD CONSTRAINT "diario_envio_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_campo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_envio" ADD CONSTRAINT "diario_envio_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_observacion" ADD CONSTRAINT "diario_observacion_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "revision"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_observacion" ADD CONSTRAINT "diario_observacion_anotacion_id_fkey" FOREIGN KEY ("anotacion_id") REFERENCES "diario_anotacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restricciones CHECK (Prisma no las expresa).
ALTER TABLE "diario_campo"
  ADD CONSTRAINT "diario_campo_estado_check"
    CHECK ("estado" IN ('en_curso', 'enviado', 'observaciones', 'revisado', 'anulado'));

ALTER TABLE "diario_anotacion"
  ADD CONSTRAINT "diario_anotacion_tipo_evento_check"
    CHECK ("tipo_evento" IN ('grupo', 'positivo', 'mejorar')),
  ADD CONSTRAINT "diario_anotacion_estado_check"
    CHECK ("estado" IN ('borrador', 'lista', 'observada')),
  -- Una anotación lista u observada siempre tiene la hora en que se marcó lista.
  ADD CONSTRAINT "diario_anotacion_lista_en_check"
    CHECK ("estado" = 'borrador' OR "lista_en" IS NOT NULL);

-- Las tablas nuevas heredan los privilegios por defecto del rol de la aplicación
-- (ALTER DEFAULT PRIVILEGES de la migración de la bitácora).
