import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { game_instance_id, question_id, question_index } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the question
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (qErr || !question) throw new Error("Question not found");

    // Fetch all answers for this question
    const { data: answers, error: aErr } = await supabase
      .from("answers")
      .select("id, guest_id, raw_answer, answered_at")
      .eq("question_id", question_id);

    if (aErr) throw new Error("Failed to fetch answers");

    // Fetch game instance for timing reference
    const { data: game, error: gErr } = await supabase
      .from("game_instances")
      .select("activated_at, config")
      .eq("id", game_instance_id)
      .single();

    if (gErr || !game) throw new Error("Game instance not found");

    const updates: { id: string; is_correct: boolean | null; points_awarded: number }[] = [];
    const timeLimitMs = (question.time_limit_seconds ?? 30) * 1000;
    const maxPoints = (game.config as { max_score?: number }).max_score ?? 1000;

    // Score each answer
    for (const answer of answers ?? []) {
      if (question.question_type === "open") {
        updates.push({ id: answer.id, is_correct: null, points_awarded: 0 });
        continue;
      }

      if (question.question_type === "numeric") {
        // Price Is Right: scored in a separate batch after all are in
        updates.push({ id: answer.id, is_correct: null, points_awarded: 0 });
        continue;
      }

      // choice
      const isCorrect = answer.raw_answer === question.correct_option_id;
      if (!isCorrect) {
        updates.push({ id: answer.id, is_correct: false, points_awarded: 0 });
        continue;
      }

      // Speed score — use server timestamps
      const questionOpensAt = new Date(answer.answered_at).getTime();
      // We can't easily get question open time here without storing it
      // For now award flat correct points; timing will be improved with opens_at stored on question
      const MIN_POINTS = Math.floor(maxPoints * 0.2);
      updates.push({ id: answer.id, is_correct: true, points_awarded: MIN_POINTS });
    }

    // Price Is Right: proximity scoring
    if (question.question_type === "numeric" && question.correct_option_id) {
      const correctValue = parseFloat(question.correct_option_id);
      const parsed = (answers ?? []).map((a) => ({
        id: a.id,
        diff: Math.abs(parseFloat(a.raw_answer) - correctValue),
        guess: parseFloat(a.raw_answer),
      }));
      const minDiff = Math.min(...parsed.map((p) => p.diff));
      for (const p of parsed) {
        const points =
          p.diff === minDiff
            ? maxPoints
            : Math.max(0, maxPoints - Math.floor((p.diff / correctValue) * maxPoints));
        const idx = updates.findIndex((u) => u.id === p.id);
        if (idx >= 0) {
          updates[idx].is_correct = p.diff === minDiff;
          updates[idx].points_awarded = points;
        }
      }
    }

    // Write scoring updates
    for (const update of updates) {
      await supabase
        .from("answers")
        .update({ is_correct: update.is_correct, points_awarded: update.points_awarded })
        .eq("id", update.id);
    }

    // Compute cumulative leaderboard
    const { data: allAnswers } = await supabase
      .from("answers")
      .select("guest_id, points_awarded, guests(display_name)")
      .eq("game_instance_id", game_instance_id);

    const totals: Record<string, { display_name: string; total: number }> = {};
    for (const a of allAnswers ?? []) {
      const name = (a.guests as { display_name: string } | null)?.display_name ?? "Guest";
      if (!totals[a.guest_id]) totals[a.guest_id] = { display_name: name, total: 0 };
      totals[a.guest_id].total += a.points_awarded;
    }

    const ranked = Object.entries(totals)
      .map(([guest_id, { display_name, total }]) => ({ guest_id, display_name, cumulative_points: total }))
      .sort((a, b) => b.cumulative_points - a.cumulative_points)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    // Write leaderboard snapshots
    for (const entry of ranked) {
      await supabase.from("leaderboard_snapshots").upsert({
        game_instance_id,
        question_index,
        guest_id: entry.guest_id,
        display_name: entry.display_name,
        cumulative_points: entry.cumulative_points,
        rank: entry.rank,
      }, { onConflict: "game_instance_id,question_index,guest_id" });
    }

    // Broadcast QUESTION_CLOSED via Realtime
    const top10 = ranked.slice(0, 10);
    await supabase.channel(`game:${game_instance_id}`).send({
      type: "broadcast",
      event: "game_event",
      payload: {
        type: "QUESTION_CLOSED",
        question_id,
        correct_option_id: question.question_type === "choice" ? question.correct_option_id : null,
        correct_value: question.question_type === "numeric" ? parseFloat(question.correct_option_id ?? "0") : undefined,
        top_10: top10,
      },
    });

    return new Response(JSON.stringify({ ok: true, scored: updates.length }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
