import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent } from "@/lib/realtime/broadcaster";
import { isWindowed } from "@/lib/games";
import type { GameType } from "@/types/game-config";

export async function POST(req: Request) {
  try {
    const { question_id, game_instance_id, guest_id, raw_answer } = await req.json();

    if (!question_id || !game_instance_id || !guest_id || raw_answer === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Verify the game accepts answers right now.
    // Per-question games: status must be 'question_open'.
    // Windowed games (find_the_guest, song/advice): answers accepted while 'active'.
    const { data: game } = await supabase
      .from("game_instances")
      .select("status, game_type")
      .eq("id", game_instance_id)
      .single();

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const gameType = game.game_type as GameType;
    const accepting =
      game.status === "question_open" ||
      (game.status === "active" && isWindowed(gameType));

    if (!accepting) {
      return NextResponse.json({ error: "Not accepting answers right now" }, { status: 409 });
    }

    // Verify guest exists and is not blocked
    const { data: guest } = await supabase
      .from("guests")
      .select("id, display_name, is_blocked")
      .eq("id", guest_id)
      .single();

    if (!guest || guest.is_blocked) {
      return NextResponse.json({ error: "Guest not found or blocked" }, { status: 403 });
    }

    // Insert answer (unique constraint prevents double-answers)
    const { error: insertErr } = await supabase
      .from("answers")
      .insert({
        question_id,
        game_instance_id,
        guest_id,
        raw_answer: String(raw_answer),
        answered_at: new Date().toISOString(),
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "Already answered" }, { status: 409 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Admin counter updates in real time (no CDC needed)
    broadcastGameEvent(game_instance_id, {
      type: "ANSWER_RECEIVED",
      game_instance_id,
      question_id,
    }).catch(() => {});

    // For open-ended review games, push the submission live to the projector display.
    if (gameType === "song_request" || gameType === "marriage_advice" || gameType === "finish_the_sentence") {
      broadcastGameEvent(game_instance_id, {
        type: "SUBMISSION_LIVE",
        game_instance_id,
        guest_name: guest.display_name,
        content: String(raw_answer),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
