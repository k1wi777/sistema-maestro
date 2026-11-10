-- BE-7 (#40) · Secciones del plan, partidas en el servidor y corrección de `mitad`.
-- Generada una sola vez con `prisma migrate diff --script` y editada a mano: la columna
-- `parte` se convierte en filas de `seccion_plan` antes de retirarla, sin perder datos.

-- CreateTable
CREATE TABLE "seccion_plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "subtitulo" VARCHAR(200),
    "orden" SMALLINT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seccion_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seccion_plan_plan_id_idx" ON "seccion_plan"("plan_id");

-- CreateIndex
-- Respalda la llave foránea compuesta de `modulo_formacion`.
CREATE UNIQUE INDEX "seccion_plan_id_plan_id_key" ON "seccion_plan"("id", "plan_id");

-- AddForeignKey
ALTER TABLE "seccion_plan" ADD CONSTRAINT "seccion_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AlterTable: partidas en curso (estado del servidor) y la sección del módulo (aún nula).
ALTER TABLE "progreso_actividad" ADD COLUMN "partida" JSONB;
ALTER TABLE "progreso_modulo" ADD COLUMN "partida_desafio" JSONB;
ALTER TABLE "modulo_formacion" ADD COLUMN "seccion_id" UUID;

-- Paso de datos: una sección por (plan, parte). `parte` nula toma el nombre del plan. El orden
-- de las secciones es el del primer módulo de cada una; el subtítulo viene de los cinco
-- encabezados del prototipo (`PARTES`) y queda nulo para cualquier otra parte.
INSERT INTO "seccion_plan" ("plan_id", "titulo", "subtitulo", "orden")
SELECT g.plan_id,
       g.titulo,
       s.subtitulo,
       dense_rank() OVER (PARTITION BY g.plan_id ORDER BY g.primer_orden, g.titulo)
FROM (
  SELECT m.plan_id,
         left(coalesce(m.parte, p.nombre), 120) AS titulo,
         min(m.orden) AS primer_orden
  FROM "modulo_formacion" m
  JOIN "plan_formacion" p ON p.id = m.plan_id
  GROUP BY m.plan_id, left(coalesce(m.parte, p.nombre), 120)
) g
LEFT JOIN (VALUES
  ('Bienvenida', 'Inducción institucional 2026–2027'),
  ('Parte I · Fundamentos y filosofía', 'Orígenes y bases científicas del modelo, y qué buscamos lograr'),
  ('Parte II · La práctica pedagógica', 'Estructura de nuestra enseñanza y lo que nos hace únicos'),
  ('Parte III · Recomendaciones específicas', 'Orientaciones para preescolar bajo y preescolar alto'),
  ('Parte IV · Nuestro talento humano', 'Propósito, principios, competencias, estructura y condiciones laborales')
) AS s (titulo, subtitulo) ON s.titulo = g.titulo;

UPDATE "modulo_formacion" m
SET "seccion_id" = sec.id
FROM "seccion_plan" sec, "plan_formacion" p
WHERE sec.plan_id = m.plan_id
  AND p.id = m.plan_id
  AND sec.titulo = left(coalesce(m.parte, p.nombre), 120);

-- Renumeración 1..n dentro de cada sección, con el mismo orden relativo.
UPDATE "modulo_formacion" m
SET "orden" = r.nuevo
FROM (
  SELECT id, row_number() OVER (PARTITION BY seccion_id ORDER BY orden, id) AS nuevo
  FROM "modulo_formacion"
) r
WHERE r.id = m.id;

ALTER TABLE "modulo_formacion" ALTER COLUMN "seccion_id" SET NOT NULL;
ALTER TABLE "modulo_formacion" DROP COLUMN "parte";

-- CreateIndex
CREATE INDEX "modulo_formacion_seccion_id_idx" ON "modulo_formacion"("seccion_id");

-- AddForeignKey
ALTER TABLE "modulo_formacion" ADD CONSTRAINT "modulo_formacion_seccion_id_plan_id_fkey" FOREIGN KEY ("seccion_id", "plan_id") REFERENCES "seccion_plan"("id", "plan_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restricciones CHECK (Prisma no las modela; nombres <tabla>_<columna>_check). La partida
-- en curso es un objeto JSON o NULL; su contenido lo valida la API.
ALTER TABLE "progreso_modulo"
  ADD CONSTRAINT progreso_modulo_partida_desafio_check
    CHECK (partida_desafio IS NULL OR jsonb_typeof(partida_desafio) = 'object');
ALTER TABLE "progreso_actividad"
  ADD CONSTRAINT progreso_actividad_partida_check
    CHECK (partida IS NULL OR jsonb_typeof(partida) = 'object');

-- Corrección de `mitad`: el simulador del bono de desempeño sembrado antes de BE-7 repite la
-- clave `mitad` en `resultados`. Se deja igual que la configuración nueva del seed (segundo
-- resultado con la clave `mitad_siguiente` y el cálculo que lo respalda). Acotado a esa
-- configuración: idempotente y sin efecto en una base vacía.
UPDATE "actividad_modulo"
SET "configuracion" = jsonb_set(
      jsonb_set(
        "configuracion",
        '{calculos}',
        (
          SELECT jsonb_agg(c.valor ORDER BY c.pos)
          FROM (
            SELECT e.valor, e.pos FROM jsonb_array_elements("configuracion"->'calculos')
              WITH ORDINALITY AS e (valor, pos)
            UNION ALL
            SELECT jsonb_build_object(
                     'clave', 'mitad_siguiente',
                     'expresion', jsonb_build_object(
                       'op', 'divide',
                       'args', jsonb_build_array(jsonb_build_object('ref', 'bono'), 2)
                     )
                   ),
                   (SELECT e2.pos FROM jsonb_array_elements("configuracion"->'calculos')
                      WITH ORDINALITY AS e2 (valor, pos)
                    WHERE e2.valor->>'clave' = 'mitad') + 0.5
          ) c
        )
      ),
      '{resultados}',
      (
        SELECT jsonb_agg(
                 CASE WHEN r.valor->>'clave' = 'mitad'
                        AND r.valor->>'etiqueta' = 'Si continúas el siguiente año (50%)'
                      THEN jsonb_set(r.valor, '{clave}', '"mitad_siguiente"')
                      ELSE r.valor END
                 ORDER BY r.pos)
        FROM jsonb_array_elements("configuracion"->'resultados') WITH ORDINALITY AS r (valor, pos)
      )
    )
WHERE "tipo" = 'simulador'
  AND (SELECT count(*) FROM jsonb_array_elements("configuracion"->'resultados') r
       WHERE r->>'clave' = 'mitad') = 2
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements("configuracion"->'calculos') c
                  WHERE c->>'clave' = 'mitad_siguiente');

-- Privilegios del rol de la aplicación sobre la tabla nueva (como en las migraciones previas).
GRANT SELECT, INSERT, UPDATE, DELETE ON "seccion_plan" TO app_gns;
