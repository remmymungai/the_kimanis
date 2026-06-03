import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent } from "@/lib/realtime/broadcaster";
import { calculateSpeedScore } from "@/lib/scoring/speedScore";
import { scorePriceIsRight } from "@/lib/scoring/priceIsRight";

// POST /api/admin/games/[id]/question — open the next question
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: game, error: gErr } = await supabase
    .from("game_instances")
    .select("*, config")
    .eq("id", id)
    .single();

  if (gErr || !game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (!["active", "question_closed"].includes(game.status)) {
    return NextResponse.json({ error: `Cannot open question from status: ${game.status}` }, { status: 409 });
  }

  const nextIndex =
    game.status === "question_closed"
      ? game.current_question_index + 1
      : game.current_question_index;

  const { data: question, error: qErr } = await supabase
    .from("questions")
    .select("*")
    .eq("game_instance_id", id)
    .eq("index", nextIndex)
    .single();

  if (qErr || !question) {
    return NextResponse.json({ error: "No question at that index. Have you reached the end?" }, { status: 404 });
  }

  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("game_instance_id", id);

  const timeLimitSeconds =
    question.time_limit_seconds ??
    (game.config as { time_limit_seconds?: number }).time_limit_seconds ??
    null;

  const opensAt = new Date();
  const closesAt = timeLimitSeconds
    ? new Date(opensAt.getTime() + timeLimitSeconds * 1000)
    : null;

  // Update game state and stamp opened_at on the question
  await Promise.all([
    supabase
      .from("game_instances")
      .update({ status: "question_open", current_question_index: nextIndex })
      .eq("id", id),
    supabase
      .from("questions")
      .update({ opened_at: opensAt.toISOString() })
      .eq("id", question.id),
  ]);

  const safeOptions = question.options
    ? (question.options as { id: string; text: string; is_correct: boolean }[]).map(
        ({ id: optId, text }) => ({ id: optId, text })
      )
    : null;

  await broadcastGameEvent(id, {
    type: "QUESTION_REVEAL",
    question: {
      id: question.id,
      index: nextIndex,
      prompt: question.prompt,
      question_type: question.question_type,
      options: safeOptions,
      time_limit_seconds: timeLimitSeconds,
      media_url: question.media_url,
      total_questions: totalQuestions ?? 0,
    },
    opens_at: opensAt.toISOString(),
    closes_at: closesAt?.toISOString() ?? null,
  });

  return NextResponse.json({ ok: true, question_index: nextIndex });
}

// DELETE /api/admin/games/[id]/question — manually close + score the current question
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: game } = await supabase
    .from("game_instances")
    .select("status, current_question_index, config")
    .eq("id", id)
    .single();

  if (!game || game.status !== "question_open") {
    return NextResponse.json({ error: "No open question to close" }, { status: 409 });
  }

  // Close the question immediately so late answers are rejected
  await supabase
    .from("game_instances")
    .update({ status: "question_closed" })
    .eq("id", id);

  // Fetch the question with its opened_at timestamp and correct answer
  const { data: question } = await supabase
    .from("questions")
    .select("id, question_type, options, correct_option_id, opened_at")
    .eq("game_instance_id", id)
    .eq("index", game.current_question_index)
    .single();

  if (!question) return NextResponse.json({ ok: true });

  const config = game.config as { time_limit_seconds?: number; max_score?: number };
  const timeLimitMs = (config.time_limit_seconds ?? 30) * 1000;
  const maxPoints = config.max_score ?? 1000;
  const openedAt = question.opened_at ? new Date(question.opened_at) : new Date();

  // Fetch all answers for this question
  const { data: answers } = await supabase
    .from("answers")
    .select("id, guest_id, raw_answer, answered_at")
    .eq("question_id", question.id);

  const scored: {
    id: string;
    guest_id: string;
    is_correct: boolean | null;
    points_awarded: number;
  }[] = [];

  if (question.question_type === "open") {
    for (const a of answers ?? []) {
      scored.push({ id: a.id, guest_id: a.guest_id, is_correct: null, points_awarded: 0 });
    }
  } else if (question.question_type === "numeric") {
    const correctValue = parseFloat(question.correct_option_id ?? "0");
    const priceScores = scorePriceIsRight(answers ?? [], correctValue, maxPoints);
    for (const a of answers ?? []) {
      const ps = priceScores.find((p) => p.guest_id === a.guest_id);
      scored.push({
        id: a.id,
        guest_id: a.guest_id,
        is_correct: ps ? ps.points === maxPoints : false,
        points_awarded: ps?.points ?? 0,
      });
    }
  } else {
    // choice — speed-weighted scoring
    for (const a of answers ?? []) {
      const isCorrect = a.raw_answer === question.correct_option_id;
      const timeToAnswerMs = new Date(a.answered_at).getTime() - openedAt.getTime();
      const points = calculateSpeedScore(isCorrect, Math.max(0, timeToAnswerMs), timeLimitMs, maxPoints);
      scored.push({ id: a.id, guest_id: a.guest_id, is_correct: isCorrect, points_awarded: points });
    }
  }

  // Write scoring results to DB
  await Promise.all(
    scored.map((s) =>
      supabase
        .from("answers")
        .update({ is_correct: s.is_correct, points_awarded: s.points_awarded })
        .eq("id", s.id)
    )
  );

  // Compute cumulative totals from all answers in this game so far
  const { data: allAnswers } = await supabase
    .from("answers")
    .select("guest_id, points_awarded, guests(display_name)")
    .eq("game_instance_id", id);

  const totals: Record<string, { display_name: string; total: number }> = {};
  for (const a of allAnswers ?? []) {
    const name =
      (a.guests as unknown as { display_name: string } | null)?.display_name ?? "Guest";
    if (!totals[a.guest_id]) totals[a.guest_id] = { display_name: name, total: 0 };
    totals[a.guest_id].total += a.points_awarded ?? 0;
  }

  const ranked = Object.entries(totals)
    .map(([guest_id, { display_name, total }]) => ({
      guest_id,
      display_name,
      cumulative_points: total,
    }))
    .sort((a, b) => b.cumulative_points - a.cumulative_points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  // Write leaderboard snapshots
  await Promise.all(
    ranked.map((entry) =>
      supabase.from("leaderboard_snapshots").upsert(
        {
          game_instance_id: id,
          question_index: game.current_question_index,
          guest_id: entry.guest_id,
          display_name: entry.display_name,
          cumulative_points: entry.cumulative_points,
          rank: entry.rank,
        },
        { onConflict: "game_instance_id,question_index,guest_id" }
      )
    )
  );

  // Build per-guest score map for the broadcast
  const playerPoints: Record<string, { points_awarded: number; is_correct: boolean | null }> = {};
  for (const s of scored) {
    playerPoints[s.guest_id] = {
      points_awarded: s.points_awarded,
      is_correct: s.is_correct,
    };
  }

  // Broadcast QUESTION_CLOSED with full scoring data
  await broadcastGameEvent(id, {
    type: "QUESTION_CLOSED",
    question_id: question.id,
    correct_option_id: question.question_type === "choice" ? question.correct_option_id : null,
    correct_value:
      question.question_type === "numeric"
        ? parseFloat(question.correct_option_id ?? "0")
        : undefined,
    top_10: ranked.slice(0, 10),
    player_points: playerPoints,
  });

  return NextResponse.json({ ok: true });
}
