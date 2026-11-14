-- BE-8 (#46) · Asistente: búsqueda en español, preguntas sin respuesta y sus ocurrencias.
-- Las tablas se generaron una sola vez con `prisma migrate diff --script`; a mano se añaden la
-- extensión `unaccent`, la configuración de búsqueda `gns_spanish`, los CHECK, el índice único
-- parcial y los privilegios, que Prisma no modela.

-- Extensión de contrib «de confianza» desde PostgreSQL 13 (la imagen postgres:16 de Compose, de las
-- pruebas y de la CI la incluye): la ejecuta quien aplica las migraciones. Vive en `public`; si
-- `migrate reset` recrea el esquema, esta migración la vuelve a crear.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Configuración de búsqueda: copia de `spanish` en la que las palabras pasan primero por `unaccent`
-- (tildes, diéresis y «ñ» se pliegan) y luego por las raíces y palabras vacías de Snowball. Documento
-- y consulta usan la misma configuración, así que «llegó», «llegada» y «LLEGA» dan la raíz `lleg`.
-- Las palabras solo ASCII (`asciiword`) no tienen marcas y conservan su mapeo a `spanish_stem`.
CREATE TEXT SEARCH CONFIGURATION gns_spanish (COPY = pg_catalog.spanish);
ALTER TEXT SEARCH CONFIGURATION gns_spanish
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;

-- CreateTable
CREATE TABLE "pregunta_sin_respuesta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "texto" VARCHAR(200),
    "texto_normalizado" VARCHAR(200),
    "veces" INTEGER NOT NULL DEFAULT 1,
    "primera_vez" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    "pregunta_frecuente_id" UUID,
    "cerrada_por" UUID,
    "cerrada_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pregunta_sin_respuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocurrencia_pregunta_sin_respuesta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pregunta_sin_respuesta_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "preguntado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocurrencia_pregunta_sin_respuesta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pregunta_sin_respuesta_pregunta_frecuente_id_idx" ON "pregunta_sin_respuesta"("pregunta_frecuente_id");

-- CreateIndex
CREATE INDEX "pregunta_sin_respuesta_cerrada_por_idx" ON "pregunta_sin_respuesta"("cerrada_por");

-- CreateIndex
CREATE INDEX "pregunta_sin_respuesta_estado_idx" ON "pregunta_sin_respuesta"("estado");

-- CreateIndex
CREATE INDEX "ocurrencia_pregunta_sin_respuesta_pregunta_sin_respuesta_id_idx" ON "ocurrencia_pregunta_sin_respuesta"("pregunta_sin_respuesta_id", "preguntado_en" DESC);

-- CreateIndex
CREATE INDEX "ocurrencia_pregunta_sin_respuesta_usuario_id_idx" ON "ocurrencia_pregunta_sin_respuesta"("usuario_id");

-- AddForeignKey
ALTER TABLE "pregunta_sin_respuesta" ADD CONSTRAINT "pregunta_sin_respuesta_pregunta_frecuente_id_fkey" FOREIGN KEY ("pregunta_frecuente_id") REFERENCES "pregunta_frecuente"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pregunta_sin_respuesta" ADD CONSTRAINT "pregunta_sin_respuesta_cerrada_por_fkey" FOREIGN KEY ("cerrada_por") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocurrencia_pregunta_sin_respuesta" ADD CONSTRAINT "ocurrencia_pregunta_sin_respuesta_pregunta_sin_respuesta_i_fkey" FOREIGN KEY ("pregunta_sin_respuesta_id") REFERENCES "pregunta_sin_respuesta"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocurrencia_pregunta_sin_respuesta" ADD CONSTRAINT "ocurrencia_pregunta_sin_respuesta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- Restricciones CHECK (Prisma no las modela; nombres <tabla>_<columna>_check). Los valores de
-- `estado` son los de `UnansweredQuestionStatus` en @gns/shared. El texto solo existe mientras la
-- pregunta está pendiente (al cerrarla se retira, pero se conservan las ocurrencias); atendida
-- exige el enlace a la pregunta frecuente y todo cierre exige quién y cuándo.
ALTER TABLE "pregunta_sin_respuesta"
  ADD CONSTRAINT pregunta_sin_respuesta_estado_check
    CHECK (estado IN ('pendiente', 'atendida', 'descartada')),
  ADD CONSTRAINT pregunta_sin_respuesta_veces_check
    CHECK (veces >= 1),
  ADD CONSTRAINT pregunta_sin_respuesta_texto_check
    CHECK ((estado = 'pendiente') = (texto IS NOT NULL AND texto_normalizado IS NOT NULL)
      AND (texto IS NULL) = (texto_normalizado IS NULL)),
  ADD CONSTRAINT pregunta_sin_respuesta_pregunta_frecuente_id_check
    CHECK ((estado = 'atendida') = (pregunta_frecuente_id IS NOT NULL)),
  ADD CONSTRAINT pregunta_sin_respuesta_cierre_check
    CHECK ((estado <> 'pendiente') = (cerrada_por IS NOT NULL AND cerrada_en IS NOT NULL)
      AND (cerrada_por IS NULL) = (cerrada_en IS NULL));

-- Una sola pregunta pendiente por texto normalizado: permite sumar de forma atómica con
-- `INSERT ... ON CONFLICT` cuando dos personas hacen la misma pregunta a la vez.
CREATE UNIQUE INDEX "pregunta_sin_respuesta_texto_pendiente_key"
  ON "pregunta_sin_respuesta" ("texto_normalizado") WHERE "estado" = 'pendiente';

-- Privilegios del rol de la aplicación: nada se borra físicamente y las ocurrencias (quién y cuándo)
-- no se modifican nunca. Los privilegios por defecto de la migración inicial concederían todo, por
-- eso se revoca de forma explícita.
GRANT SELECT, INSERT, UPDATE ON "pregunta_sin_respuesta" TO app_gns;
REVOKE DELETE ON "pregunta_sin_respuesta" FROM app_gns;
GRANT SELECT, INSERT ON "ocurrencia_pregunta_sin_respuesta" TO app_gns;
REVOKE UPDATE, DELETE ON "ocurrencia_pregunta_sin_respuesta" FROM app_gns;
