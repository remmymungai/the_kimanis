import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent } from "@/lib/realtime/broadcaster";
import type { LeaderboardEntry } from "@/types/realtime";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: game } = await supabase
    .from("game_instances")
    .select("status, current_question_index")
    .eq("id", id)
    .single();

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  await supabase
    .from("game_instances")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);

  // Fetch final leaderboard from last snapshot
  const { data: snapshots } = await supabase
    .from("leaderboard_snapshots")
    .select("guest_id, display_name, cumulative_points, rank")
    .eq("game_instance_id", id)
    .eq("question_index", game.current_question_index)
    .order("rank", { ascending: true })
    .limit(10);

  const finalLeaderboard: LeaderboardEntry[] = (snapshots ?? []).map((s) => ({
    guest_id: s.guest_id,
    display_name: s.display_name,
    cumulative_points: s.cumulative_points,
    rank: s.rank,
  }));

  await broadcastGameEvent(id, {
    type: "GAME_COMPLETED",
    game_instance_id: id,
    final_leaderboard: finalLeaderboard,
  });

  return NextResponse.json({ ok: true });
}
