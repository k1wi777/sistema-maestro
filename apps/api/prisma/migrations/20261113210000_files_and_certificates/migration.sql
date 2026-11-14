-- BE-7 (#41) · Archivos del almacenamiento, certificados con instantánea y código verificable.
-- Generada una sola vez con `prisma migrate diff --script` y editada a mano: se añaden los CHECK,
-- los índices únicos parciales y los privilegios, que Prisma no modela. `certificado` aún no tiene
-- filas (los certificados llegan con este Work Item), por eso las columnas nuevas son NOT NULL sin defecto.

-- AlterTable
ALTER TABLE "certificado" ADD COLUMN     "archivo_id" UUID,
ADD COLUMN     "nombre_docente" VARCHAR(120) NOT NULL,
ADD COLUMN     "plan_nombre" VARCHAR(120),
ADD COLUMN     "titulo" VARCHAR(160) NOT NULL;

-- AlterTable
ALTER TABLE "modulo_formacion" ADD COLUMN     "presentacion_archivo_id" UUID,
ADD COLUMN     "video_archivo_id" UUID;

-- CreateTable
CREATE TABLE "archivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clave_objeto" VARCHAR(200) NOT NULL,
    "proposito" VARCHAR(20) NOT NULL,
    "tipo_contenido" VARCHAR(100) NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "nombre_original" VARCHAR(160),
    "estado" VARCHAR(12) NOT NULL,
    "subido_por" UUID,
    "confirmado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archivo_clave_objeto_key" ON "archivo"("clave_objeto");

-- CreateIndex
CREATE INDEX "archivo_subido_por_idx" ON "archivo"("subido_por");

-- CreateIndex
CREATE INDEX "certificado_archivo_id_idx" ON "certificado"("archivo_id");

-- CreateIndex
CREATE INDEX "modulo_formacion_video_archivo_id_idx" ON "modulo_formacion"("video_archivo_id");

-- CreateIndex
CREATE INDEX "modulo_formacion_presentacion_archivo_id_idx" ON "modulo_formacion"("presentacion_archivo_id");

-- AddForeignKey
ALTER TABLE "modulo_formacion" ADD CONSTRAINT "modulo_formacion_video_archivo_id_fkey" FOREIGN KEY ("video_archivo_id") REFERENCES "archivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "modulo_formacion" ADD CONSTRAINT "modulo_formacion_presentacion_archivo_id_fkey" FOREIGN KEY ("presentacion_archivo_id") REFERENCES "archivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "certificado" ADD CONSTRAINT "certificado_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "archivo" ADD CONSTRAINT "archivo_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restricciones CHECK (Prisma no las modela; nombres <tabla>_<columna>_check). Los valores son
-- las constantes de @gns/shared (`training/files.ts`).
ALTER TABLE "archivo"
  ADD CONSTRAINT archivo_proposito_check
    CHECK (proposito IN ('video_modulo', 'presentacion_modulo', 'certificado')),
  ADD CONSTRAINT archivo_estado_check
    CHECK (estado IN ('pendiente', 'disponible', 'rechazado')),
  ADD CONSTRAINT archivo_tamano_bytes_check
    CHECK (tamano_bytes > 0);

-- Un módulo no tiene a la vez enlace y archivo para el mismo propósito.
ALTER TABLE "modulo_formacion"
  ADD CONSTRAINT modulo_formacion_video_exclusivo_check
    CHECK (video_url IS NULL OR video_archivo_id IS NULL),
  ADD CONSTRAINT modulo_formacion_presentacion_exclusiva_check
    CHECK (presentacion_url IS NULL OR presentacion_archivo_id IS NULL);

-- Un certificado por docente y módulo, y uno solo de ruta completa (módulo nulo) por docente.
CREATE UNIQUE INDEX "certificado_docente_modulo_key"
  ON "certificado" ("docente_id", "modulo_id") WHERE "modulo_id" IS NOT NULL;
CREATE UNIQUE INDEX "certificado_docente_ruta_key"
  ON "certificado" ("docente_id") WHERE "modulo_id" IS NULL;

-- Privilegios del rol de la aplicación: sin DELETE (nada se borra físicamente). Los privilegios
-- por defecto de la migración inicial se lo concederían, por eso se revoca de forma explícita.
GRANT SELECT, INSERT, UPDATE ON "archivo", "certificado" TO app_gns;
REVOKE DELETE ON "archivo", "certificado" FROM app_gns;
