-- ============================================================
-- TURNOS DE LÍDER: genera el cronograma y alimenta las 3 tablas
--
--   calendario_turnos                 -> fuente (el dash / la captura)
--   notificacion_truface              -> se llena sola (tareas 'Truface')
--   notificacion_cambio_lider_semana  -> se llena sola (1 fila por bloque de 2 semanas,
--                                        el martes en que empieza el líder)
--
-- Reglas (validadas contra los turnos de Majo y Karen):
--   * Cada líder dura 2 semanas, de martes a lunes (14 días).
--   * Truface: lunes, miércoles y viernes.   Generar Tip: jueves.
--   * Si el día es festivo, la tarea pasa al siguiente día hábil.
--
-- Ejecutar completo en Supabase → SQL Editor (proyecto donde están las tablas).
-- NO modifica las filas que ya existen.
-- ============================================================

-- ── 1) Festivos de Colombia (agrega los del año siguiente cuando toque) ──
CREATE TABLE IF NOT EXISTS public.festivos_co (
  fecha  DATE PRIMARY KEY,
  nombre TEXT
);

INSERT INTO public.festivos_co (fecha, nombre) VALUES
  ('2026-01-01','Año Nuevo'),
  ('2026-01-12','Reyes Magos'),
  ('2026-03-23','San José'),
  ('2026-04-02','Jueves Santo'),
  ('2026-04-03','Viernes Santo'),
  ('2026-05-01','Día del Trabajo'),
  ('2026-05-18','Ascensión del Señor'),
  ('2026-06-08','Corpus Christi'),
  ('2026-06-15','Sagrado Corazón'),
  ('2026-06-29','San Pedro y San Pablo'),
  ('2026-07-20','Independencia'),
  ('2026-08-07','Batalla de Boyacá'),
  ('2026-08-17','Asunción de la Virgen'),
  ('2026-10-12','Día de la Raza'),
  ('2026-11-02','Todos los Santos'),
  ('2026-11-16','Independencia de Cartagena'),
  ('2026-12-08','Inmaculada Concepción'),
  ('2026-12-25','Navidad')
ON CONFLICT (fecha) DO NOTHING;

-- ── 2) Inserta solo las columnas que existan en la tabla destino ──
--      (así funciona aunque notificacion_* tenga o no la columna "correo")
CREATE OR REPLACE FUNCTION public._insert_flex(p_table TEXT, p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ', ')
    INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table
    AND jsonb_exists(p_payload, c.column_name);

  IF cols IS NULL THEN
    RAISE EXCEPTION 'No hay columnas coincidentes en %', p_table;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)',
    p_table, cols, cols, p_table
  ) USING p_payload;
END;
$$;

-- ── 3) Trigger: calendario_turnos -> notificaciones ──
CREATE OR REPLACE FUNCTION public.sync_turnos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  martes   DATE;
  existing RECORD;
BEGIN
  -- Si se borra/cambia un turno Truface, quitar su notificación
  IF TG_OP IN ('UPDATE', 'DELETE') AND lower(trim(OLD.tarea)) = 'truface' THEN
    DELETE FROM notificacion_truface
    WHERE fecha = OLD.fecha AND lider = OLD.lider AND lower(trim(tarea)) = 'truface';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Turno Truface -> notificación de ese día (sin duplicar)
  IF lower(trim(NEW.tarea)) = 'truface' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notificacion_truface t
      WHERE t.fecha = NEW.fecha AND t.lider = NEW.lider AND lower(trim(t.tarea)) = 'truface'
    ) THEN
      PERFORM public._insert_flex('notificacion_truface', jsonb_build_object(
        'fecha', NEW.fecha, 'tarea', NEW.tarea, 'lider', NEW.lider,
        'id_telegram', NEW.id_telegram, 'correo', NEW.correo));
    END IF;
  END IF;

  -- Cambio de líder (la función generar_turnos() ya lo crea y desactiva este paso)
  IF coalesce(current_setting('turnos.skip_notif', true), '0') <> '1' THEN
    martes := (date_trunc('week', NEW.fecha)::date) + 1;

    SELECT * INTO existing
    FROM notificacion_cambio_lider_semana c
    WHERE c.lider = NEW.lider AND abs(c.fecha - martes) <= 13
    ORDER BY abs(c.fecha - martes)
    LIMIT 1;

    IF existing.id IS NULL THEN
      PERFORM public._insert_flex('notificacion_cambio_lider_semana', jsonb_build_object(
        'fecha', martes, 'lider', NEW.lider, 'id_telegram', NEW.id_telegram, 'correo', NEW.correo,
        'pronombre', (SELECT p.pronombre FROM notificacion_cambio_lider_semana p
                      WHERE p.lider = NEW.lider AND p.pronombre IS NOT NULL
                      ORDER BY p.fecha DESC LIMIT 1)));
    ELSIF martes < existing.fecha THEN
      UPDATE notificacion_cambio_lider_semana SET fecha = martes WHERE id = existing.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_turnos ON public.calendario_turnos;
CREATE TRIGGER trg_sync_turnos
AFTER INSERT OR UPDATE OR DELETE ON public.calendario_turnos
FOR EACH ROW EXECUTE FUNCTION public.sync_turnos();

-- ── 4) Generador: crea las 2 semanas de un líder ──
CREATE OR REPLACE FUNCTION public.generar_turnos(
  p_lider       TEXT,
  p_id_telegram TEXT,
  p_correo      TEXT,
  p_pronombre   TEXT,
  p_inicio      DATE      -- debe ser MARTES
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i        INT;
  d        DATE;
  dow      INT;
  v_tarea  TEXT;
  n        INT := 0;
BEGIN
  IF extract(isodow FROM p_inicio) <> 2 THEN
    RAISE EXCEPTION 'La fecha de inicio (%) debe ser martes', p_inicio;
  END IF;

  PERFORM set_config('turnos.skip_notif', '1', true);

  FOR i IN 0..13 LOOP
    d   := p_inicio + i;
    dow := extract(isodow FROM d)::INT;

    IF dow IN (1, 3, 5) THEN v_tarea := 'Truface';
    ELSIF dow = 4        THEN v_tarea := 'Generar Tip';
    ELSE CONTINUE;
    END IF;

    -- festivo (o fin de semana) -> siguiente día hábil
    WHILE extract(isodow FROM d) > 5 OR EXISTS (SELECT 1 FROM festivos_co f WHERE f.fecha = d) LOOP
      d := d + 1;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM calendario_turnos t
      WHERE t.fecha = d AND t.tarea = v_tarea AND t.lider = p_lider
    ) THEN
      INSERT INTO calendario_turnos (fecha, tarea, lider, id_telegram, correo)
      VALUES (d, v_tarea, p_lider, p_id_telegram, p_correo);
      n := n + 1;
    END IF;
  END LOOP;

  -- Notificación de cambio de líder: el martes en que empieza
  IF NOT EXISTS (
    SELECT 1 FROM notificacion_cambio_lider_semana c WHERE c.lider = p_lider AND c.fecha = p_inicio
  ) THEN
    PERFORM public._insert_flex('notificacion_cambio_lider_semana', jsonb_build_object(
      'fecha', p_inicio, 'lider', p_lider, 'id_telegram', p_id_telegram,
      'correo', p_correo, 'pronombre', p_pronombre));
  END IF;

  PERFORM set_config('turnos.skip_notif', '0', true);
  RETURN n;
END;
$$;

-- ------------------------------------------------------------
-- USO (una línea por líder; devuelve cuántos turnos creó):
--
-- SELECT generar_turnos('Grisell Quiroz',  '@GrisellQuiroz',  'CORREO_DE_GRISELL@truora.com', 'Ella', '2026-11-10');
-- SELECT generar_turnos('Cristian Rojas',  '@CristianMRojas', 'cmrojas@truora.com',           'El',   '2026-11-24');
--
-- Ejemplo: el lunes 16-nov-2026 es festivo, así que su Truface pasa al martes 17-nov.
-- ------------------------------------------------------------
