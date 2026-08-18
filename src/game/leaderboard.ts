import { supabase } from "@/integrations/supabase/client";

export type RunEntry = { name: string; total_seconds: number; accuracy: number; score: number };

/** Points for a single level, purely from accuracy. */
export function levelPoints(accuracy: number) {
  const acc = Math.max(0, Math.min(100, Math.round(accuracy)));
  if (acc >= 99) return 100;
  if (acc >= 80) return 80;
  if (acc >= 60) return 50;
  return 1;
}

/** Run score = sum of every level's accuracy points (max 1000 over 10 levels). */
export function runScore(accuracies: number[]) {
  return accuracies.reduce((s, a) => s + levelPoints(a), 0);
}

/** Kept for the stored run row: average accuracy scored across 10 levels. */
export function computeScore(_totalSeconds: number, accuracy: number) {
  return levelPoints(accuracy) * 10;
}

export async function fetchTopRuns(limit = 10): Promise<RunEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("name, total_seconds, accuracy, score")
    .order("score", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as RunEntry[];
}

export async function submitRun(entry: Omit<RunEntry, "score"> & { score?: number }): Promise<void> {
  await supabase.from("leaderboard").insert({
    name: entry.name.slice(0, 20) || "Shopper",
    total_seconds: Math.max(1, Math.round(entry.total_seconds)),
    accuracy: Math.max(0, Math.min(100, Math.round(entry.accuracy))),
    score: entry.score ?? computeScore(entry.total_seconds, entry.accuracy),
  });
}

export type HallEntry = RunEntry & { created_at: string };

/** Everyone who has ever finished all 10 levels — kept forever, newest first. */
export async function fetchHallOfFame(limit = 50): Promise<HallEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("name, total_seconds, accuracy, score, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as HallEntry[];
}
