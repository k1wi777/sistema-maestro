-- Issue #96 · Observador: bloque «Estrategias pedagógicas».
-- Solo añade una columna anulable: no borra ni reescribe filas; las anotaciones existentes
-- quedan con el bloque vacío. Los privilegios de `app_gns` son por tabla y no cambian.

-- AlterTable
ALTER TABLE "observador_anotacion" ADD COLUMN     "estrategias_pedagogicas" TEXT;
