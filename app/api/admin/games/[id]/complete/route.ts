import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent } from "@/lib/realtime/broadcaster";
import { isScoredWindowed } from "@/lib/games";
import type { LeaderboardEntry } from "@/types/realtime";
import type { GameType } from "@/types/game-config";

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
    .select("status, current_question_index, game_type")
    .eq("id", id)
    .single();

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const gameType = game.game_type as GameType;

  await supabase
    .from("game_instances")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);

  // Find the Guest is scored only at the end of its window: flat 500 per correct cell.
  if (isScoredWindowed(gameType)) {
    const { data: questions } = await supabase
      .from("questions")
      .select("id, correct_option_id")
      .eq("game_instance_id", id);
    const correctById = new Map((questions ?? []).map((q) => [q.id, q.correct_option_id]));

    const { data: answers } = await supabase
      .from("answers")
      .select("id, guest_id, question_id, raw_answer")
      .eq("game_instance_id", id);

    // Score each answer
    await Promise.all(
      (answers ?? []).map((a) => {
        const isCorrect = a.raw_answer === correctById.get(a.question_id);
        return supabase
          .from("answers")
          .update({ is_correct: isCorrect, points_awarded: isCorrect ? 500 : 0 })
          .eq("id", a.id);
      })
    );
  }

  // Compute the final leaderboard from all scored answers in this game.
  const { data: allAnswers } = await supabase
    .from("answers")
    .select("guest_id, points_awarded, guests(display_name)")
    .eq("game_instance_id", id);

  const totals: Record<string, { display_name: string; total: number }> = {};
  for (const a of allAnswers ?? []) {
    const name = (a.guests as unknown as { display_name: string } | null)?.display_name ?? "Guest";
    if (!totals[a.guest_id]) totals[a.guest_id] = { display_name: name, total: 0 };
    totals[a.guest_id].total += a.points_awarded ?? 0;
  }

  const ranked = Object.entries(totals)
    .map(([guest_id, { display_name, total }]) => ({ guest_id, display_name, cumulative_points: total }))
    .sort((a, b) => b.cumulative_points - a.cumulative_points)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Persist a final snapshot so the leaderboard survives reloads.
  if (ranked.length > 0) {
    await Promise.all(
      ranked.map((e) =>
        supabase.from("leaderboard_snapshots").upsert(
          {
            game_instance_id: id,
            question_index: game.current_question_index,
            guest_id: e.guest_id,
            display_name: e.display_name,
            cumulative_points: e.cumulative_points,
            rank: e.rank,
          },
          { onConflict: "game_instance_id,question_index,guest_id" }
        )
      )
    );
  }

  const finalLeaderboard: LeaderboardEntry[] = ranked.slice(0, 10);

  await broadcastGameEvent(id, {
    type: "GAME_COMPLETED",
    game_instance_id: id,
    final_leaderboard: finalLeaderboard,
  });

  return NextResponse.json({ ok: true });
}
