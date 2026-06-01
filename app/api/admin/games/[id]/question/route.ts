import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent } from "@/lib/realtime/broadcaster";

// POST /api/admin/games/[id]/question — open the next (or a specific) question
export async function POST(
  req: Request,
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

  // Fetch the question at nextIndex
  const { data: question, error: qErr } = await supabase
    .from("questions")
    .select("*")
    .eq("game_instance_id", id)
    .eq("index", nextIndex)
    .single();

  if (qErr || !question) {
    return NextResponse.json({ error: "No question at that index. Did you reach the end?" }, { status: 404 });
  }

  // Get total question count
  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("game_instance_id", id);

  const timeLimitSeconds = question.time_limit_seconds ?? (game.config as { time_limit_seconds?: number }).time_limit_seconds ?? null;
  const opensAt = new Date();
  const closesAt = timeLimitSeconds ? new Date(opensAt.getTime() + timeLimitSeconds * 1000) : null;

  // Update game state
  await supabase
    .from("game_instances")
    .update({ status: "question_open", current_question_index: nextIndex })
    .eq("id", id);

  // Strip is_correct from options before broadcasting
  const safeOptions = question.options
    ? (question.options as { id: string; text: string; is_correct: boolean }[]).map(({ id: optId, text }) => ({
        id: optId,
        text,
      }))
    : null;

  // Broadcast question reveal
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

  // Auto-close timer via Edge Function (fire-and-forget)
  if (closesAt) {
    const delayMs = closesAt.getTime() - Date.now();
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/close-question-timer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        game_instance_id: id,
        question_id: question.id,
        question_index: nextIndex,
        delay_ms: delayMs,
      }),
    }).catch(() => {}); // Non-blocking
  }

  return NextResponse.json({ ok: true, question_index: nextIndex });
}

// DELETE /api/admin/games/[id]/question — manually close the current question
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

  await supabase
    .from("game_instances")
    .update({ status: "question_closed" })
    .eq("id", id);

  // Fetch question for scoring
  const { data: question } = await supabase
    .from("questions")
    .select("id")
    .eq("game_instance_id", id)
    .eq("index", game.current_question_index)
    .single();

  if (question) {
    // Trigger scoring Edge Function (fire-and-forget)
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/score-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        game_instance_id: id,
        question_id: question.id,
        question_index: game.current_question_index,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
