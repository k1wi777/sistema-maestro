-- #117 · Descartar borradores: protección del borrado real.
-- Lo enviado nunca se borra (se anula). La única excepción es el borrador que nunca se
-- envió, que su autor puede descartar. Estos triggers BEFORE DELETE se aplican a cualquier
-- usuario (también al rol de la aplicación, que tiene DELETE sobre estas tablas), así que un
-- error de código no puede borrar un registro enviado. Prisma no modela triggers: este SQL es
-- la única fuente de verdad y el esquema Prisma no cambia.

-- Planeación: solo un borrador que nunca se envió (`enviada_en` vacío).
CREATE OR REPLACE FUNCTION planeacion_solo_borrador() RETURNS trigger AS $$
BEGIN
  IF OLD.estado <> 'borrador' OR OLD.enviada_en IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se puede borrar una planeación en borrador que nunca se envió';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planeacion_sin_borrar_enviadas BEFORE DELETE ON planeacion
  FOR EACH ROW EXECUTE FUNCTION planeacion_solo_borrador();

-- Observador: `borrador` implica nunca enviada (devolver deja `observaciones`).
CREATE OR REPLACE FUNCTION observador_anotacion_solo_borrador() RETURNS trigger AS $$
BEGIN
  IF OLD.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede borrar una anotación del observador en borrador';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER observador_anotacion_sin_borrar_enviadas BEFORE DELETE ON observador_anotacion
  FOR EACH ROW EXECUTE FUNCTION observador_anotacion_solo_borrador();

-- Diario de campo: la anotación debe estar en borrador y sin enviar, y su diario «en curso»
-- (nunca enviado: reenviar sale de `observaciones`, nunca vuelve a `en_curso`).
CREATE OR REPLACE FUNCTION diario_anotacion_solo_borrador() RETURNS trigger AS $$
BEGIN
  IF OLD.estado <> 'borrador' OR OLD.enviada THEN
    RAISE EXCEPTION 'Solo se puede borrar una anotación del diario en borrador que nunca se envió';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM diario_campo WHERE id = OLD.diario_id AND estado = 'en_curso'
  ) THEN
    RAISE EXCEPTION 'Solo se puede borrar una anotación de un diario que sigue en curso';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diario_anotacion_sin_borrar_enviadas BEFORE DELETE ON diario_anotacion
  FOR EACH ROW EXECUTE FUNCTION diario_anotacion_solo_borrador();

CREATE OR REPLACE FUNCTION diario_campo_solo_en_curso() RETURNS trigger AS $$
BEGIN
  IF OLD.estado <> 'en_curso' OR OLD.enviado_en IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se puede borrar un diario en curso que nunca se envió';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diario_campo_sin_borrar_enviados BEFORE DELETE ON diario_campo
  FOR EACH ROW EXECUTE FUNCTION diario_campo_solo_en_curso();
