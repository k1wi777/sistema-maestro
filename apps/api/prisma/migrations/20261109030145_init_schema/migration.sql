-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_completo" VARCHAR(120) NOT NULL,
    "correo_institucional" VARCHAR(160) NOT NULL,
    "rol" VARCHAR(20) NOT NULL,
    "estado" VARCHAR(10) NOT NULL,
    "creado_por" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimiento_datos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "version_politica" VARCHAR(20) NOT NULL,
    "aceptado_en" TIMESTAMPTZ(6) NOT NULL,
    "casillas" TEXT[],
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimiento_datos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nivel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(60) NOT NULL,
    "orden" SMALLINT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nivel_id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "orden" SMALLINT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(80) NOT NULL,
    "tipo" VARCHAR(12) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo_academico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anio_lectivo" VARCHAR(9) NOT NULL,
    "numero" SMALLINT NOT NULL,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodo_academico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_docente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "anio_lectivo" VARCHAR(9) NOT NULL,
    "es_director_grupo" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignacion_docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planeacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "fecha_desde" DATE,
    "fecha_hasta" DATE,
    "tema" VARCHAR(160),
    "proyecto_transversal" VARCHAR(60),
    "desempeno_esperado" TEXT,
    "rincon" VARCHAR(60),
    "etapa_curiocity" VARCHAR(20),
    "momento_exploracion" TEXT,
    "momento_desarrollo" TEXT,
    "momento_socializacion" TEXT,
    "momento_cierre" TEXT,
    "recursos" TEXT,
    "ajustes_razonables" TEXT,
    "estado" VARCHAR(14) NOT NULL,
    "enviada_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planeacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurso_planeacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "planeacion_id" UUID NOT NULL,
    "herramienta" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(120),
    "url" TEXT NOT NULL,
    "momento" SMALLINT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurso_planeacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo_registro" VARCHAR(12) NOT NULL,
    "registro_id" UUID NOT NULL,
    "revisor_id" UUID NOT NULL,
    "accion" VARCHAR(14) NOT NULL,
    "comentario" TEXT,
    "campos_ajustados" TEXT[],
    "fecha" TIMESTAMPTZ(6) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividad_repositorio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "autor_id" UUID NOT NULL,
    "nivel_id" UUID,
    "area_id" UUID,
    "titulo" VARCHAR(160) NOT NULL,
    "objetivo" TEXT,
    "duracion_min" SMALLINT,
    "materiales" TEXT,
    "pasos" TEXT NOT NULL,
    "enlace" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_repositorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorito_actividad" (
    "usuario_id" UUID NOT NULL,
    "actividad_id" UUID NOT NULL,

    CONSTRAINT "favorito_actividad_pkey" PRIMARY KEY ("usuario_id","actividad_id")
);

-- CreateTable
CREATE TABLE "diario_campo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "estado" VARCHAR(14) NOT NULL,
    "enviada_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_campo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_entrada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "diario_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "clase" VARCHAR(80),
    "tipo_evento" VARCHAR(10) NOT NULL,
    "estudiantes" VARCHAR(160),
    "descripcion" TEXT NOT NULL,
    "acciones" TEXT,
    "reflexion" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_entrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observador_anotacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "grado_id" UUID NOT NULL,
    "estudiante_nombre" VARCHAR(40) NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" VARCHAR(12) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "version_estudiante" TEXT,
    "acciones" TEXT,
    "familia_informada" BOOLEAN NOT NULL DEFAULT false,
    "seguimiento" TEXT,
    "estado" VARCHAR(14) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observador_anotacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_formacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "area_id" UUID,
    "nombre" VARCHAR(120) NOT NULL,
    "anio_lectivo" VARCHAR(9),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_formacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulo_formacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "parte" VARCHAR(60),
    "numero" VARCHAR(4),
    "orden" SMALLINT NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "resumen" TEXT,
    "video_url" TEXT,
    "presentacion_url" TEXT,
    "estado" VARCHAR(14) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modulo_formacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diapositiva" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modulo_id" UUID NOT NULL,
    "orden" SMALLINT NOT NULL,
    "titulo" VARCHAR(160),
    "ideas_clave" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diapositiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregunta_desafio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modulo_id" UUID NOT NULL,
    "orden" SMALLINT NOT NULL,
    "tipo" VARCHAR(8) NOT NULL,
    "enunciado" TEXT NOT NULL,
    "retroalimentacion" TEXT,
    "respuesta_vf" BOOLEAN,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pregunta_desafio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcion_pregunta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pregunta_id" UUID NOT NULL,
    "texto" VARCHAR(200) NOT NULL,
    "es_correcta" BOOLEAN,
    "orden_correcto" SMALLINT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opcion_pregunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso_modulo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "modulo_id" UUID NOT NULL,
    "video_visto_en" TIMESTAMPTZ(6),
    "presentacion_vista_en" TIMESTAMPTZ(6),
    "mejor_puntaje" SMALLINT,
    "aprobado_en" TIMESTAMPTZ(6),
    "terminado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progreso_modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intento_desafio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "progreso_id" UUID NOT NULL,
    "puntaje" SMALLINT NOT NULL,
    "puntos" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intento_desafio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "docente_id" UUID NOT NULL,
    "modulo_id" UUID,
    "codigo" VARCHAR(20) NOT NULL,
    "emitido_en" TIMESTAMPTZ(6) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregunta_frecuente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoria" VARCHAR(40) NOT NULL,
    "pregunta" VARCHAR(200) NOT NULL,
    "respuesta" TEXT NOT NULL,
    "palabras_clave" TEXT,
    "fuente" VARCHAR(120),
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_por" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pregunta_frecuente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora" (
    -- Retoque manual: Prisma genera BIGSERIAL; el modelo validado usa una identidad
    -- GENERATED ALWAYS para que nadie fije el consecutivo a mano.
    "id" BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "rol" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "accion" VARCHAR(160) NOT NULL,
    "entidad" VARCHAR(40),
    "entidad_id" UUID,
    "detalle" TEXT,
    "datos_antes" JSONB,
    "datos_despues" JSONB,

    CONSTRAINT "bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_institucional_key" ON "usuario"("correo_institucional");

-- CreateIndex
CREATE INDEX "usuario_creado_por_idx" ON "usuario"("creado_por");

-- CreateIndex
CREATE INDEX "consentimiento_datos_usuario_id_idx" ON "consentimiento_datos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "consentimiento_datos_usuario_id_version_politica_key" ON "consentimiento_datos"("usuario_id", "version_politica");

-- CreateIndex
CREATE UNIQUE INDEX "nivel_nombre_key" ON "nivel"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "grado_nombre_key" ON "grado"("nombre");

-- CreateIndex
CREATE INDEX "grado_nivel_id_idx" ON "grado"("nivel_id");

-- CreateIndex
CREATE UNIQUE INDEX "area_nombre_key" ON "area"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_academico_anio_lectivo_numero_key" ON "periodo_academico"("anio_lectivo", "numero");

-- CreateIndex
CREATE INDEX "asignacion_docente_docente_id_idx" ON "asignacion_docente"("docente_id");

-- CreateIndex
CREATE INDEX "asignacion_docente_grado_id_idx" ON "asignacion_docente"("grado_id");

-- CreateIndex
CREATE INDEX "asignacion_docente_area_id_idx" ON "asignacion_docente"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_docente_docente_id_grado_id_area_id_anio_lectivo_key" ON "asignacion_docente"("docente_id", "grado_id", "area_id", "anio_lectivo");

-- CreateIndex
CREATE INDEX "planeacion_docente_id_idx" ON "planeacion"("docente_id");

-- CreateIndex
CREATE INDEX "planeacion_grado_id_idx" ON "planeacion"("grado_id");

-- CreateIndex
CREATE INDEX "planeacion_area_id_idx" ON "planeacion"("area_id");

-- CreateIndex
CREATE INDEX "planeacion_periodo_id_idx" ON "planeacion"("periodo_id");

-- CreateIndex
CREATE INDEX "recurso_planeacion_planeacion_id_idx" ON "recurso_planeacion"("planeacion_id");

-- CreateIndex
CREATE INDEX "revision_revisor_id_idx" ON "revision"("revisor_id");

-- CreateIndex
CREATE INDEX "revision_tipo_registro_registro_id_idx" ON "revision"("tipo_registro", "registro_id");

-- CreateIndex
CREATE INDEX "actividad_repositorio_autor_id_idx" ON "actividad_repositorio"("autor_id");

-- CreateIndex
CREATE INDEX "actividad_repositorio_nivel_id_idx" ON "actividad_repositorio"("nivel_id");

-- CreateIndex
CREATE INDEX "actividad_repositorio_area_id_idx" ON "actividad_repositorio"("area_id");

-- CreateIndex
CREATE INDEX "diario_campo_docente_id_idx" ON "diario_campo"("docente_id");

-- CreateIndex
CREATE INDEX "diario_campo_grado_id_idx" ON "diario_campo"("grado_id");

-- CreateIndex
CREATE INDEX "diario_campo_periodo_id_idx" ON "diario_campo"("periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "diario_campo_docente_id_grado_id_periodo_id_key" ON "diario_campo"("docente_id", "grado_id", "periodo_id");

-- CreateIndex
CREATE INDEX "diario_entrada_diario_id_idx" ON "diario_entrada"("diario_id");

-- CreateIndex
CREATE INDEX "observador_anotacion_docente_id_idx" ON "observador_anotacion"("docente_id");

-- CreateIndex
CREATE INDEX "observador_anotacion_grado_id_idx" ON "observador_anotacion"("grado_id");

-- CreateIndex
CREATE INDEX "plan_formacion_area_id_idx" ON "plan_formacion"("area_id");

-- CreateIndex
CREATE INDEX "modulo_formacion_plan_id_idx" ON "modulo_formacion"("plan_id");

-- CreateIndex
CREATE INDEX "diapositiva_modulo_id_idx" ON "diapositiva"("modulo_id");

-- CreateIndex
CREATE INDEX "pregunta_desafio_modulo_id_idx" ON "pregunta_desafio"("modulo_id");

-- CreateIndex
CREATE INDEX "opcion_pregunta_pregunta_id_idx" ON "opcion_pregunta"("pregunta_id");

-- CreateIndex
CREATE INDEX "progreso_modulo_docente_id_idx" ON "progreso_modulo"("docente_id");

-- CreateIndex
CREATE INDEX "progreso_modulo_modulo_id_idx" ON "progreso_modulo"("modulo_id");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_modulo_docente_id_modulo_id_key" ON "progreso_modulo"("docente_id", "modulo_id");

-- CreateIndex
CREATE INDEX "intento_desafio_progreso_id_idx" ON "intento_desafio"("progreso_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificado_codigo_key" ON "certificado"("codigo");

-- CreateIndex
CREATE INDEX "certificado_docente_id_idx" ON "certificado"("docente_id");

-- CreateIndex
CREATE INDEX "certificado_modulo_id_idx" ON "certificado"("modulo_id");

-- CreateIndex
CREATE INDEX "pregunta_frecuente_actualizado_por_idx" ON "pregunta_frecuente"("actualizado_por");

-- CreateIndex
CREATE INDEX "bitacora_usuario_id_idx" ON "bitacora"("usuario_id");

-- CreateIndex
CREATE INDEX "bitacora_fecha_hora_idx" ON "bitacora"("fecha_hora" DESC);

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consentimiento_datos" ADD CONSTRAINT "consentimiento_datos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grado" ADD CONSTRAINT "grado_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "nivel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planeacion" ADD CONSTRAINT "planeacion_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planeacion" ADD CONSTRAINT "planeacion_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planeacion" ADD CONSTRAINT "planeacion_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planeacion" ADD CONSTRAINT "planeacion_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo_academico"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recurso_planeacion" ADD CONSTRAINT "recurso_planeacion_planeacion_id_fkey" FOREIGN KEY ("planeacion_id") REFERENCES "planeacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "revision" ADD CONSTRAINT "revision_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "actividad_repositorio" ADD CONSTRAINT "actividad_repositorio_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "actividad_repositorio" ADD CONSTRAINT "actividad_repositorio_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "nivel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "actividad_repositorio" ADD CONSTRAINT "actividad_repositorio_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorito_actividad" ADD CONSTRAINT "favorito_actividad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorito_actividad" ADD CONSTRAINT "favorito_actividad_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividad_repositorio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_campo" ADD CONSTRAINT "diario_campo_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo_academico"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diario_entrada" ADD CONSTRAINT "diario_entrada_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_campo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "observador_anotacion" ADD CONSTRAINT "observador_anotacion_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "observador_anotacion" ADD CONSTRAINT "observador_anotacion_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_formacion" ADD CONSTRAINT "plan_formacion_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "modulo_formacion" ADD CONSTRAINT "modulo_formacion_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "diapositiva" ADD CONSTRAINT "diapositiva_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulo_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pregunta_desafio" ADD CONSTRAINT "pregunta_desafio_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulo_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "opcion_pregunta" ADD CONSTRAINT "opcion_pregunta_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "pregunta_desafio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "progreso_modulo" ADD CONSTRAINT "progreso_modulo_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "progreso_modulo" ADD CONSTRAINT "progreso_modulo_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulo_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "intento_desafio" ADD CONSTRAINT "intento_desafio_progreso_id_fkey" FOREIGN KEY ("progreso_id") REFERENCES "progreso_modulo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "certificado" ADD CONSTRAINT "certificado_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "certificado" ADD CONSTRAINT "certificado_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulo_formacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pregunta_frecuente" ADD CONSTRAINT "pregunta_frecuente_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
