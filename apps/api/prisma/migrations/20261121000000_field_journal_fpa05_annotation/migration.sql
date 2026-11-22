-- Diario de campo alineado al formato F-PA-05: la anotación queda en clase (asignatura) y
-- descripción de eventos. Se retiran la restricción del tipo de evento y las columnas de
-- tipo de evento, estudiantes, acciones y reflexión de `diario_anotacion`. Ninguna fila se
-- borra ni cambia: las columnas restantes conservan tipo y nulabilidad. No se toca el
-- archivo histórico (`diario_entrada_historico`) ni la bitácora (inmutable).
ALTER TABLE "diario_anotacion" DROP CONSTRAINT IF EXISTS "diario_anotacion_tipo_evento_check";

ALTER TABLE "diario_anotacion"
  DROP COLUMN "tipo_evento",
  DROP COLUMN "estudiantes",
  DROP COLUMN "acciones",
  DROP COLUMN "reflexion";
