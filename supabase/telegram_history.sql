-- ============================================================
-- TABLA: telegram_history  (historial/cronograma de envíos)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_history (
  id            BIGSERIAL PRIMARY KEY,
  send_at       TIMESTAMPTZ NOT NULL,            -- fecha/hora de envío (o programada)
  origin        TEXT NOT NULL CHECK (origin IN ('announcement','tip')),
  status        TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','error')),
  sender_email  TEXT NOT NULL,
  sender_name   TEXT NOT NULL,
  title         TEXT,                            -- título del tip
  message       TEXT NOT NULL,
  recipients    TEXT[] DEFAULT '{}',             -- analistas / tags destino
  media_kind    TEXT,                            -- 'image' | 'video' | NULL
  links         JSONB  DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE telegram_history ENABLE ROW LEVEL SECURITY;

-- Todos los líderes autenticados ven el historial completo
CREATE POLICY "leaders_read_history" ON telegram_history
  FOR SELECT TO authenticated USING (true);

-- Cada líder solo puede registrar envíos a su nombre
CREATE POLICY "leaders_insert_own_history" ON telegram_history
  FOR INSERT TO authenticated
  WITH CHECK (LOWER(sender_email) = LOWER(auth.jwt() ->> 'email'));

CREATE POLICY "service_role_all_history" ON telegram_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_history_send_at ON telegram_history (send_at);
