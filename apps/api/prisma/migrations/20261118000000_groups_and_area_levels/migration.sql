-- Catálogo de grados, grupos y áreas con coordinación por grado. En una sola transacción:
-- grupos por grado, activo de grados y áreas, coordinadora por grado, relación área–nivel y
-- asignación docente por grupo. Conserva los datos: cada asignación pasa al grupo «<grado> 1»
-- de su mismo grado (anuladas y retiradas incluidas) y el director de grupo sigue siendo el
-- mismo docente. Ninguna otra fila cambia; la bitácora solo recibe un CHECK nuevo (DDL).

-- CreateTable
CREATE TABLE "grupo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grado_id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grupo_grado_id_idx" ON "grupo"("grado_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_grado_id_nombre_key" ON "grupo"("grado_id", "nombre");

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Grado: activo y coordinadora (a lo sumo una por grado, por construcción).
ALTER TABLE "grado" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "coordinador_id" UUID;

-- CreateIndex
CREATE INDEX "grado_coordinador_id_idx" ON "grado"("coordinador_id");

-- AddForeignKey
ALTER TABLE "grado" ADD CONSTRAINT "grado_coordinador_id_fkey" FOREIGN KEY ("coordinador_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Área: activa.
ALTER TABLE "area" ADD COLUMN "activa" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "area_nivel" (
    "area_id" UUID NOT NULL,
    "nivel_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_nivel_pkey" PRIMARY KEY ("area_id","nivel_id")
);

-- CreateIndex
CREATE INDEX "area_nivel_nivel_id_idx" ON "area_nivel"("nivel_id");

-- AddForeignKey
ALTER TABLE "area_nivel" ADD CONSTRAINT "area_nivel_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "area_nivel" ADD CONSTRAINT "area_nivel_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "nivel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Relación área–nivel equivalente a la regla fija anterior (copia congelada de las listas de
-- `areaNamesForLevel`). En una base vacía no inserta nada: lo hace el seed inicial.
INSERT INTO "area_nivel" ("area_id", "nivel_id")
SELECT a."id", n."id"
FROM "area" a
JOIN "nivel" n ON (
  (n."nombre" IN ('Preescolar bajo', 'Preescolar alto (KTF)') AND a."nombre" IN (
    'Dimensión cognitiva', 'Dimensión comunicativa', 'Dimensión corporal y motora',
    'Dimensión estética', 'Dimensión socioafectiva', 'Dimensión espiritual', 'Dimensión ética',
    'English (CLIL)', 'Pre-ciencias', 'Lengua Castellana', 'Ciencias Naturales',
    'Ciencias Sociales', 'Math', 'Science', 'Art', 'Música', 'Deportes', 'Social Studies'))
  OR (n."nombre" IN ('Primaria', 'Bachillerato') AND a."nombre" IN (
    'Lengua Castellana', 'Ciencias Naturales', 'Ciencias Sociales', 'Math', 'Science',
    'English', 'Art', 'Música', 'Deportes', 'Social Studies', 'Matemáticas',
    'Tecnología e Informática', 'Educación Artística', 'Educación Física', 'Ética y Valores',
    'Educación Religiosa'))
  OR (n."nombre" = 'Bachillerato' AND a."nombre" IN (
    'Física', 'Química', 'Filosofía', 'Ciencias Económicas y Políticas', 'Emprendimiento'))
);

-- Un grupo «<grado> 1» por cada grado con alguna asignación (de cualquier estado); coincide con
-- el primer grupo que el seed carga en preescolar, que lo reconoce por (grado_id, nombre).
INSERT INTO "grupo" ("grado_id", "nombre")
SELECT g."id", g."nombre" || ' 1'
FROM "grado" g
WHERE EXISTS (SELECT 1 FROM "asignacion_docente" ad WHERE ad."grado_id" = g."id");

-- Asignación por grupo.
ALTER TABLE "asignacion_docente" ADD COLUMN "grupo_id" UUID;

UPDATE "asignacion_docente" ad
SET "grupo_id" = gr."id"
FROM "grupo" gr
WHERE gr."grado_id" = ad."grado_id"
  AND gr."nombre" = (SELECT g."nombre" || ' 1' FROM "grado" g WHERE g."id" = ad."grado_id");

ALTER TABLE "asignacion_docente" ALTER COLUMN "grupo_id" SET NOT NULL;

-- Antes había un director por grado (con la marca posiblemente en varias filas suyas): se deja
-- una sola marca por (grupo, año) entre las activas —la de la fila más antigua— y se quita la
-- de las retiradas.
UPDATE "asignacion_docente" SET "es_director_grupo" = false WHERE "estado" <> 'activa';

UPDATE "asignacion_docente" ad
SET "es_director_grupo" = false
WHERE ad."es_director_grupo"
  AND ad."id" <> (
    SELECT f."id"
    FROM "asignacion_docente" f
    WHERE f."grupo_id" = ad."grupo_id"
      AND f."anio_lectivo" = ad."anio_lectivo"
      AND f."es_director_grupo"
    ORDER BY f."creado_en", f."id"
    LIMIT 1
  );

-- Cambio de la llave natural y de los índices.
DROP INDEX "asignacion_docente_docente_id_grado_id_area_id_anio_lectivo_key";
DROP INDEX "asignacion_docente_grado_id_idx";
ALTER TABLE "asignacion_docente" DROP CONSTRAINT "asignacion_docente_grado_id_fkey";
ALTER TABLE "asignacion_docente" DROP COLUMN "grado_id";

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_docente_docente_id_grupo_id_area_id_anio_lectivo_key" ON "asignacion_docente"("docente_id", "grupo_id", "area_id", "anio_lectivo");

-- CreateIndex
CREATE INDEX "asignacion_docente_grupo_id_idx" ON "asignacion_docente"("grupo_id");

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Un director(a) por grupo y año lectivo entre las asignaciones activas (Prisma no lo expresa).
CREATE UNIQUE INDEX "asignacion_docente_director_grupo_unico"
  ON "asignacion_docente" ("grupo_id", "anio_lectivo")
  WHERE "es_director_grupo" AND "estado" = 'activa';

-- La bitácora admite el tipo «estructura» (DDL: no toca filas).
ALTER TABLE "bitacora" DROP CONSTRAINT "bitacora_tipo_check";
ALTER TABLE "bitacora"
  ADD CONSTRAINT "bitacora_tipo_check"
    CHECK (tipo IN ('ingreso', 'planeacion', 'diario', 'observador', 'formacion',
                    'repositorio', 'asistente', 'datos', 'coordinacion', 'estructura'));

-- Privilegios del rol de la aplicación sobre las tablas nuevas.
GRANT SELECT, INSERT, UPDATE, DELETE ON "grupo", "area_nivel" TO app_gns;
