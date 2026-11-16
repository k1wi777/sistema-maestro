-- Una planeación pasa a tener una o más áreas (dimensiones o asignaturas): el área única de
-- «planeacion» se reemplaza por la relación «planeacion_area». Conserva los datos: antes de
-- retirar «area_id» se copia a la relación el área de TODAS las planeaciones (anuladas
-- incluidas); ningún otro dato de la planeación, sus enlaces, revisiones ni la bitácora cambia.

-- CreateTable
CREATE TABLE "planeacion_area" (
    "planeacion_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planeacion_area_pkey" PRIMARY KEY ("planeacion_id","area_id")
);

-- CreateIndex
CREATE INDEX "planeacion_area_area_id_idx" ON "planeacion_area"("area_id");

-- AddForeignKey
ALTER TABLE "planeacion_area" ADD CONSTRAINT "planeacion_area_planeacion_id_fkey" FOREIGN KEY ("planeacion_id") REFERENCES "planeacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planeacion_area" ADD CONSTRAINT "planeacion_area_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Conserva el área de cada planeación existente.
INSERT INTO "planeacion_area" ("planeacion_id", "area_id", "creado_en", "actualizado_en")
SELECT "id", "area_id", "creado_en", "creado_en" FROM "planeacion";

-- Retira el área única.
ALTER TABLE "planeacion" DROP CONSTRAINT "planeacion_area_id_fkey";
DROP INDEX "planeacion_area_id_idx";
ALTER TABLE "planeacion" DROP COLUMN "area_id";

-- Privilegios del rol de la aplicación sobre la tabla nueva (como en las migraciones previas).
GRANT SELECT, INSERT, UPDATE, DELETE ON "planeacion_area" TO app_gns;
