import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { question_id, game_instance_id, guest_id, raw_answer } = await req.json();

    if (!question_id || !game_instance_id || !guest_id || raw_answer === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Verify game is still open
    const { data: game } = await supabase
      .from("game_instances")
      .select("status")
      .eq("id", game_instance_id)
      .single();

    if (!game || game.status !== "question_open") {
      return NextResponse.json({ error: "Question is not open" }, { status: 409 });
    }

    // Verify guest exists and is not blocked
    const { data: guest } = await supabase
      .from("guests")
      .select("id, is_blocked")
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
