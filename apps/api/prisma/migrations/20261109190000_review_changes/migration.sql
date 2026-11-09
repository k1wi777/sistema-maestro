-- BE-5 · Valores anterior y nuevo de los ajustes de coordinación.
-- AlterTable
ALTER TABLE "revision" ADD COLUMN     "cambios" JSONB;

-- Prisma no modela CHECK: se declaran aquí.
ALTER TABLE revision
  -- Forma `{ columna: { antes, despues } }`; NULL en las filas sin valores guardados.
  ADD CONSTRAINT revision_cambios_check CHECK (cambios IS NULL OR jsonb_typeof(cambios) = 'object');

ALTER TABLE recurso_planeacion
  -- Momento de la clase al que se asocia el enlace; NULL = enlace general.
  ADD CONSTRAINT recurso_planeacion_momento_check CHECK (momento IS NULL OR momento BETWEEN 1 AND 4);
