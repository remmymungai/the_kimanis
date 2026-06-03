import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent, broadcastEventWide } from "@/lib/realtime/broadcaster";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch game
  const { data: game, error: gErr } = await supabase
    .from("game_instances")
    .select("*, events(id)")
    .eq("id", id)
    .single();

  if (gErr || !game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.status !== "pending") return NextResponse.json({ error: "Game already started" }, { status: 409 });

  // Activate game
  const { error: uErr } = await supabase
    .from("game_instances")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", id);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  const eventId = (game.events as { id: string })?.id ?? game.event_id;

  // Broadcast to all guests
  await broadcastEventWide(eventId, {
    type: "GAME_STATE_CHANGE",
    game_instance_id: id,
    new_status: "active",
    current_question_index: 0,
  });

  return NextResponse.json({ ok: true });
}
