import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastGameEvent } from "@/lib/realtime/broadcaster";

// PATCH — approve a confession (publish to the wall)
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: confession, error } = await supabase
    .from("confessions")
    .update({ is_approved: true })
    .eq("id", id)
    .select("id, content, game_instance_id")
    .single();

  if (error || !confession) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  // Push it live to the wall
  broadcastGameEvent(confession.game_instance_id, {
    type: "CONFESSION_LIVE",
    id: confession.id,
    content: confession.content,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

// DELETE — hide/remove a confession
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("confessions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
