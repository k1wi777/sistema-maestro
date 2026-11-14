-- BE-9 (#50) · Bitácora: índice compuesto para la paginación por keyset (fecha_hora DESC, id DESC).
-- Generado con `prisma migrate diff --script`. Solo DDL de índices: no toca la función
-- `bitacora_inmutable`, los triggers ni los privilegios de `app_gns` (los define la migración
-- init_schema/BE-12).

-- DropIndex
DROP INDEX "bitacora_fecha_hora_idx";

-- CreateIndex
CREATE INDEX "bitacora_fecha_hora_id_idx" ON "bitacora"("fecha_hora" DESC, "id" DESC);
