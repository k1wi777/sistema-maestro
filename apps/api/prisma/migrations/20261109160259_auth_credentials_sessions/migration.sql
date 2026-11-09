-- CreateTable
CREATE TABLE "credencial_contrasena" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "hash" VARCHAR(255) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credencial_contrasena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "proveedor" VARCHAR(20) NOT NULL,
    "generacion" INTEGER NOT NULL DEFAULT 0,
    "rotada_en" TIMESTAMPTZ(6),
    "renovada_en" TIMESTAMPTZ(6) NOT NULL,
    "expira_en" TIMESTAMPTZ(6),
    "revocada_en" TIMESTAMPTZ(6),
    "motivo_revocacion" VARCHAR(20),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credencial_contrasena_usuario_id_key" ON "credencial_contrasena"("usuario_id");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- AddForeignKey
ALTER TABLE "credencial_contrasena" ADD CONSTRAINT "credencial_contrasena_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- BE-31/32 · Restricciones CHECK y privilegios (Prisma no los modela).
-- La base rechaza cualquier valor que no sea un hash argon2id: impide guardar una
-- contraseña en claro por error.
ALTER TABLE credencial_contrasena
  ADD CONSTRAINT credencial_contrasena_hash_check CHECK (hash LIKE '$argon2id$%');

ALTER TABLE sesion
  ADD CONSTRAINT sesion_proveedor_check CHECK (proveedor IN ('contrasena')),
  ADD CONSTRAINT sesion_generacion_check CHECK (generacion >= 0),
  ADD CONSTRAINT sesion_expira_en_check CHECK (expira_en IS NULL OR expira_en > creado_en),
  ADD CONSTRAINT sesion_motivo_revocacion_check
    CHECK (motivo_revocacion IN ('cierre', 'desactivacion', 'contrasena', 'reutilizacion')),
  -- La revocación y su motivo van siempre juntas.
  ADD CONSTRAINT sesion_revocacion_check CHECK ((revocada_en IS NULL) = (motivo_revocacion IS NULL));

-- Los privilegios por defecto (BE-12) ya los conceden; se repiten para no depender del rol
-- que ejecute la migración. GRANT sobre un privilegio ya concedido es idempotente.
GRANT SELECT, INSERT, UPDATE, DELETE ON credencial_contrasena, sesion TO app_gns;
