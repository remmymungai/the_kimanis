import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { broadcastEventWide } from "@/lib/realtime/broadcaster";

const EVENT_SLUG = "kimanis-2026";

export async function POST(req: Request) {
  try {
    const { display_name } = await req.json();
    const name = String(display_name ?? "").trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }

    const supabase = await createAdminClient();

    const { data: event } = await supabase
      .from("events").select("id").eq("slug", EVENT_SLUG).eq("is_active", true).single();
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    // Reclaim an existing session if the name is already taken (case-insensitive)
    const { data: existing } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", event.id)
      .ilike("display_name", name)
      .maybeSingle();

    if (existing) {
      if (existing.is_blocked) {
        return NextResponse.json({ error: "You've been removed from the games by the host." }, { status: 403 });
      }
      return NextResponse.json({ guest: existing, reclaimed: true });
    }

    const { data: guest, error } = await supabase
      .from("guests")
      .insert({ event_id: event.id, display_name: name })
      .select()
      .single();

    if (error || !guest) {
      if (error?.code === "23505") {
        return NextResponse.json({ error: "That name is already taken! Try adding your surname." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not join. Please try again." }, { status: 500 });
    }

    broadcastEventWide(event.id, {
      type: "GUEST_JOINED",
      guest_id: guest.id,
      display_name: guest.display_name,
    }).catch(() => {});

    return NextResponse.json({ guest, reclaimed: false });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
