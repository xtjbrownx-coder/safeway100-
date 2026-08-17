import { supabase } from "@/integrations/supabase/client";

export type RunEntry = { name: string; total_seconds: number; accuracy: number };

export async function fetchTopRuns(limit = 10): Promise<RunEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("name, total_seconds, accuracy")
    .order("total_seconds", { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as RunEntry[];
}

export async function submitRun(entry: RunEntry): Promise<void> {
  await supabase.from("leaderboard").insert({
    name: entry.name.slice(0, 20) || "Shopper",
    total_seconds: Math.max(1, Math.round(entry.total_seconds)),
    accuracy: Math.max(0, Math.min(100, Math.round(entry.accuracy))),
  });
}
