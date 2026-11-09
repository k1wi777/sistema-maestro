-- BE-12 · Bitácora inmutable y rol de la aplicación.
-- Prisma no modela funciones, triggers ni privilegios: este SQL es la única
-- fuente de verdad y las migraciones futuras no lo tocan.

-- La bitácora es de solo inserción. Los triggers se aplican a cualquier usuario,
-- también al propietario de la tabla y al superusuario, así que la protección no
-- depende de con qué usuario se conecte la API.
CREATE OR REPLACE FUNCTION bitacora_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora no se puede modificar ni borrar';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bitacora_sin_cambios BEFORE UPDATE OR DELETE ON bitacora
  FOR EACH ROW EXECUTE FUNCTION bitacora_inmutable();

-- TRUNCATE no dispara triggers por fila; este también cubre TRUNCATE ... CASCADE
-- desde una tabla padre (usuario).
CREATE TRIGGER bitacora_sin_vaciar BEFORE TRUNCATE ON bitacora
  FOR EACH STATEMENT EXECUTE FUNCTION bitacora_inmutable();

-- Rol de la aplicación. Los roles son globales del clúster y la base sombra de
-- migrate dev / migrate reset vuelve a aplicar esta migración, por eso se crea
-- solo si no existe. Es NOLOGIN: el usuario con el que se conecta la API hereda
-- de él y lo define el despliegue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_gns') THEN
    CREATE ROLE app_gns NOLOGIN;
  END IF;
END;
$$;

-- Sobre la bitácora, solo insertar y consultar.
REVOKE UPDATE, DELETE, TRUNCATE ON bitacora FROM app_gns;
GRANT SELECT, INSERT ON bitacora TO app_gns;

-- Sobre las otras 24 tablas, lectura y escritura (sin TRUNCATE).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  usuario,
  consentimiento_datos,
  nivel,
  grado,
  area,
  periodo_academico,
  asignacion_docente,
  planeacion,
  recurso_planeacion,
  revision,
  actividad_repositorio,
  favorito_actividad,
  diario_campo,
  diario_entrada,
  observador_anotacion,
  plan_formacion,
  modulo_formacion,
  diapositiva,
  pregunta_desafio,
  opcion_pregunta,
  progreso_modulo,
  intento_desafio,
  certificado,
  pregunta_frecuente
TO app_gns;

-- Las tablas que creen migraciones futuras heredan los mismos permisos. La
-- bitácora ya existe y no se ve afectada.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_gns;
