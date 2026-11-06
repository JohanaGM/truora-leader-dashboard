-- ============================================================
-- TABLA: tip_analysts  (analista asignado a cada tip de la biblioteca)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
CREATE TABLE IF NOT EXISTS tip_analysts (
  file_id     TEXT PRIMARY KEY,          -- id del archivo en Drive
  analyst     TEXT NOT NULL,             -- mención, p. ej. @JohaGMora
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tip_analysts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaders_read_tip_analysts" ON tip_analysts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "leaders_write_tip_analysts" ON tip_analysts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
