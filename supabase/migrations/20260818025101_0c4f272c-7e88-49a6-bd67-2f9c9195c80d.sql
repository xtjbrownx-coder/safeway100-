ALTER TABLE public.leaderboard ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;
UPDATE public.leaderboard SET score = GREATEST(0, accuracy * 50 + GREATEST(0, 1800 - total_seconds) * 2) WHERE score = 0;
CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON public.leaderboard (score DESC);