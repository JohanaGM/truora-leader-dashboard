-- ============================================================
-- TABLA: leader_schedule
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS leader_schedule (
  id          BIGSERIAL PRIMARY KEY,
  fecha       DATE        NOT NULL,
  tarea       TEXT        NOT NULL,   -- 'Truface' | 'Generar Tip'
  lider       TEXT        NOT NULL,
  id_telegram TEXT,
  correo      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE leader_schedule ENABLE ROW LEVEL SECURITY;

-- Cada líder solo ve sus propias filas (por correo)
CREATE POLICY "leader_sees_own_schedule"
  ON leader_schedule
  FOR SELECT
  TO authenticated
  USING (TRIM(LOWER(correo)) = LOWER(auth.jwt() ->> 'email'));

-- El service_role (backend) puede hacer todo
CREATE POLICY "service_role_all"
  ON leader_schedule
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Índice para búsquedas rápidas por correo + fecha ────────
CREATE INDEX IF NOT EXISTS idx_leader_schedule_correo_fecha
  ON leader_schedule (TRIM(LOWER(correo)), fecha);

-- ── Datos del CSV ────────────────────────────────────────────
INSERT INTO leader_schedule (fecha, tarea, lider, id_telegram, correo) VALUES
  ('2026-05-04', 'Truface',      'Katerine Angarita',  '@KaterineAngarita',   NULL),
  ('2026-05-05', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-06', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-08', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-11', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-13', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-15', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-19', 'Truface',      'Majo velasquez',     '@majovelasquez',      NULL),
  ('2026-05-20', 'Truface',      'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-05-22', 'Truface',      'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-05-25', 'Truface',      'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-05-27', 'Truface',      'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-05-27', 'Generar Tip',  'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-05-29', 'Truface',      'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-06-01', 'Truface',      'Cristian Rojas',     '@CristianMRojas',     'cmrojas@truora.com'),
  ('2026-06-03', 'Truface',      'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-04', 'Generar Tip',  'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-05', 'Truface',      'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-09', 'Truface',      'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-10', 'Truface',      'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-11', 'Generar Tip',  'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-12', 'Truface',      'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-16', 'Truface',      'Valentina Mesa',     '@ValentinaMesaB',     'vmesa@truora.com'),
  ('2026-06-17', 'Truface',      'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-18', 'Generar Tip',  'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-19', 'Truface',      'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-22', 'Truface',      'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-24', 'Truface',      'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-25', 'Generar Tip',  'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-26', 'Truface',      'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-06-30', 'Truface',      'Miroslawa Estrada',  '@JMiroslawaEstrada',  'jmiroslawa@truora.com'),
  ('2026-07-01', 'Truface',      'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-02', 'Generar Tip',  'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-03', 'Truface',      'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-06', 'Truface',      'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-08', 'Truface',      'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-09', 'Generar Tip',  'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-10', 'Truface',      'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com'),
  ('2026-07-13', 'Truface',      'Erik Castro',        '@Erikcastro23',       'efcastro@truora.com');

-- ── NOTA ─────────────────────────────────────────────────────
-- Katerine Angarita y Majo Velasquez no tienen correo en la base.
-- Para que sus tareas aparezcan, ejecuta:
--   UPDATE leader_schedule SET correo = 'tu@email.com'
--   WHERE lider = 'Katerine Angarita';
-- con el correo real que usan para iniciar sesión en el dashboard.
