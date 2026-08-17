CREATE TABLE public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  total_seconds integer not null check (total_seconds > 0 and total_seconds < 100000),
  accuracy integer not null default 100 check (accuracy between 0 and 100),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.leaderboard TO anon;
GRANT SELECT, INSERT ON public.leaderboard TO authenticated;
GRANT ALL ON public.leaderboard TO service_role;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view leaderboard" ON public.leaderboard FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can post a run" ON public.leaderboard FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE INDEX leaderboard_time_idx ON public.leaderboard (total_seconds ASC);