-- CreateTable
CREATE TABLE "anio_lectivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(9) NOT NULL,
    "vigente" BOOLEAN,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anio_lectivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anio_lectivo_codigo_key" ON "anio_lectivo"("codigo");

-- CreateIndex
-- `vigente` es true en el año vigente y NULL en los demás: el UNIQUE admite muchos NULL y un
-- solo true, así que la base impide dos años vigentes.
CREATE UNIQUE INDEX "anio_lectivo_vigente_key" ON "anio_lectivo"("vigente");

-- BE-4 · Restricciones CHECK del año lectivo (Prisma no las modela).
ALTER TABLE anio_lectivo
  -- AAAA-AAAA con el segundo año igual al primero más uno (mismo criterio que `schoolYearSchema`).
  ADD CONSTRAINT anio_lectivo_codigo_check CHECK (
    codigo ~ '^[0-9]{4}-[0-9]{4}$'
    AND substr(codigo, 6, 4)::int = substr(codigo, 1, 4)::int + 1
  ),
  ADD CONSTRAINT anio_lectivo_vigente_check CHECK (vigente IS NULL OR vigente);

-- Relleno: registra los años que ya usan periodos y asignaciones para que las bases ya
-- sembradas cumplan las llaves foráneas sin perder filas. No marca ninguno como vigente: esa
-- decisión es de datos y la toma el seed o administración. Un año mal formado hace fallar la
-- migración con el CHECK anterior.
INSERT INTO anio_lectivo (codigo)
SELECT anio_lectivo FROM periodo_academico
UNION
SELECT anio_lectivo FROM asignacion_docente
ON CONFLICT (codigo) DO NOTHING;

-- AddForeignKey
ALTER TABLE "periodo_academico" ADD CONSTRAINT "periodo_academico_anio_lectivo_fkey" FOREIGN KEY ("anio_lectivo") REFERENCES "anio_lectivo"("codigo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_anio_lectivo_fkey" FOREIGN KEY ("anio_lectivo") REFERENCES "anio_lectivo"("codigo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AlterTable
ALTER TABLE "asignacion_docente" ADD COLUMN     "estado" VARCHAR(10) NOT NULL DEFAULT 'activa';

ALTER TABLE asignacion_docente
  ADD CONSTRAINT asignacion_docente_estado_check CHECK (estado IN ('activa', 'retirada'));

-- Los privilegios por defecto (BE-12) ya los conceden; se repiten para no depender del rol
-- que ejecute la migración. GRANT sobre un privilegio ya concedido es idempotente.
GRANT SELECT, INSERT, UPDATE, DELETE ON anio_lectivo TO app_gns;
