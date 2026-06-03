import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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
    .select("status, title")
    .eq("id", id)
    .single();

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  if (["active", "question_open", "question_closed"].includes(game.status)) {
    return NextResponse.json(
      { error: "Cannot delete an active game. End it first." },
      { status: 409 }
    );
  }

  // FK cascade deletes questions, answers, leaderboard_snapshots, etc.
  const { error } = await supabase
    .from("game_instances")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
