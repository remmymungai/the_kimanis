import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { game_instance_id, content, guest_id } = await req.json();
    if (!game_instance_id || !content?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Only accept while the confessions game is active
    const { data: game } = await supabase
      .from("game_instances")
      .select("status, game_type")
      .eq("id", game_instance_id)
      .single();

    if (!game || game.game_type !== "confessions_wall" || game.status !== "active") {
      return NextResponse.json({ error: "Confessions are not open" }, { status: 409 });
    }

    // Always pending — appears on the wall only after admin approval.
    // guest_id is stored for post-party reference only; it is never exposed on
    // any wall, broadcast, or moderation screen (confessions stay anonymous).
    const { error } = await supabase.from("confessions").insert({
      game_instance_id,
      content: String(content).trim().slice(0, 280),
      is_approved: false,
      guest_id: guest_id ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
