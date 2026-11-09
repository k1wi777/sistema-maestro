-- BE-13 · Restricciones CHECK de estados y tipos.
-- Prisma no modela CHECK: se declaran aquí con el nombre que PostgreSQL asigna a
-- los CHECK en línea del modelo validado (<tabla>_<columna>_check). Los valores
-- deben coincidir con las constantes de @gns/shared; las pruebas de base de
-- datos lo comprueban.

ALTER TABLE usuario
  ADD CONSTRAINT usuario_rol_check CHECK (rol IN ('docente', 'coordinador', 'administrador')),
  ADD CONSTRAINT usuario_estado_check CHECK (estado IN ('activo', 'inactivo'));

ALTER TABLE area
  ADD CONSTRAINT area_tipo_check CHECK (tipo IN ('asignatura', 'dimension'));

-- Siempre 3 periodos por año lectivo.
ALTER TABLE periodo_academico
  ADD CONSTRAINT periodo_academico_numero_check CHECK (numero BETWEEN 1 AND 3);

-- Planeación, diario y observador comparten el mismo flujo de revisión y se
-- anulan en lugar de borrarse.
ALTER TABLE planeacion
  ADD CONSTRAINT planeacion_estado_check
    CHECK (estado IN ('borrador', 'enviada', 'observaciones', 'revisada', 'anulado'));

ALTER TABLE revision
  ADD CONSTRAINT revision_tipo_registro_check
    CHECK (tipo_registro IN ('planeacion', 'diario', 'observador')),
  ADD CONSTRAINT revision_accion_check
    CHECK (accion IN ('ajuste', 'observaciones', 'aprobada'));

ALTER TABLE diario_campo
  ADD CONSTRAINT diario_campo_estado_check
    CHECK (estado IN ('borrador', 'enviada', 'observaciones', 'revisada', 'anulado'));

ALTER TABLE diario_entrada
  ADD CONSTRAINT diario_entrada_tipo_evento_check
    CHECK (tipo_evento IN ('grupo', 'positivo', 'mejorar'));

ALTER TABLE observador_anotacion
  ADD CONSTRAINT observador_anotacion_tipo_check
    CHECK (tipo IN ('positiva', 'academica', 'tipo_i', 'tipo_ii', 'tipo_iii', 'otra')),
  ADD CONSTRAINT observador_anotacion_estado_check
    CHECK (estado IN ('borrador', 'enviada', 'observaciones', 'revisada', 'anulado'));

ALTER TABLE modulo_formacion
  ADD CONSTRAINT modulo_formacion_estado_check CHECK (estado IN ('activo', 'fuera_del_plan'));

ALTER TABLE pregunta_desafio
  ADD CONSTRAINT pregunta_desafio_tipo_check CHECK (tipo IN ('opcion', 'vf', 'orden'));

ALTER TABLE bitacora
  ADD CONSTRAINT bitacora_tipo_check
    CHECK (tipo IN ('ingreso', 'planeacion', 'diario', 'observador', 'formacion',
                    'repositorio', 'asistente', 'datos', 'coordinacion'));
