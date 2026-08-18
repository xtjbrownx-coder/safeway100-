import { supabase } from "@/integrations/supabase/client";

export type RunEntry = { name: string; total_seconds: number; accuracy: number; score: number };

/** Points: accuracy is king, speed adds a shrinking bonus. */
export function computeScore(totalSeconds: number, accuracy: number) {
  const acc = Math.max(0, Math.min(100, Math.round(accuracy)));
  const speedBonus = Math.max(0, 1800 - Math.round(totalSeconds)) * 2;
  return Math.max(0, acc * 50 + speedBonus);
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

export async function submitRun(entry: Omit<RunEntry, "score">): Promise<void> {
  await supabase.from("leaderboard").insert({
    name: entry.name.slice(0, 20) || "Shopper",
    total_seconds: Math.max(1, Math.round(entry.total_seconds)),
    accuracy: Math.max(0, Math.min(100, Math.round(entry.accuracy))),
    score: computeScore(entry.total_seconds, entry.accuracy),
  });
}
