-- Register every Supabase Auth user that is not yet in public.leaders.
-- Run this in the SQL Editor of project zoyfudgcghnlipujxhgr.

CREATE TABLE IF NOT EXISTS public.leaders (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  team_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'leader',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_can_read_leaders" ON public.leaders;
CREATE POLICY "authenticated_users_can_read_leaders"
  ON public.leaders
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
  );

-- Create missing leader rows. Existing rows are left unchanged so that
-- is_active=false remains an intentional administrator decision.
INSERT INTO public.leaders (
  id,
  email,
  full_name,
  team_name,
  role,
  is_active
)
SELECT
  u.id,
  LOWER(TRIM(u.email)),
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'name'), ''),
    SPLIT_PART(u.email, '@', 1)
  ),
  NULL,
  'leader',
  true
FROM auth.users AS u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.leaders AS l
    WHERE l.id = u.id
       OR LOWER(TRIM(l.email)) = LOWER(TRIM(u.email))
  );

-- Review all registered leaders.
SELECT id, email, full_name, role, is_active
FROM public.leaders
ORDER BY email;

-- Detect Auth users that still have no matching leader row.
SELECT u.id, u.email
FROM auth.users AS u
LEFT JOIN public.leaders AS l ON l.id = u.id
WHERE u.email IS NOT NULL
  AND l.id IS NULL
ORDER BY u.email;
