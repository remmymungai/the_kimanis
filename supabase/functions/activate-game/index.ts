import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { game_instance_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: game, error: gErr } = await supabase
      .from("game_instances")
      .select("*, events(id)")
      .eq("id", game_instance_id)
      .single();

    if (gErr || !game) throw new Error("Game not found");

    // For find_the_guest: auto-generate questions from current guest snapshot
    if (game.game_type === "find_the_guest") {
      const { data: guests, error: guestsErr } = await supabase
        .from("guests")
        .select("id, display_name")
        .eq("event_id", game.event_id)
        .eq("is_blocked", false);

      if (guestsErr || !guests?.length) throw new Error("No guests found");

      // Get existing questions (admin may have pre-loaded prompts)
      const { data: existingQuestions } = await supabase
        .from("questions")
        .select("*")
        .eq("game_instance_id", game_instance_id)
        .order("index");

      if (existingQuestions?.length) {
        // Questions already exist — populate options from guest snapshot
        for (const q of existingQuestions) {
          // Find correct guest by prompt match or stored correct_option_id
          const correctGuest = guests.find(g => g.id === q.correct_option_id) ?? guests[0];
          const otherGuests = shuffle(guests.filter(g => g.id !== correctGuest.id)).slice(0, 3);
          const allOptions = shuffle([correctGuest, ...otherGuests]).map(g => ({
            id: g.id,
            text: g.display_name,
            is_correct: g.id === correctGuest.id,
          }));

          await supabase
            .from("questions")
            .update({ options: allOptions })
            .eq("id", q.id);
        }
      }
    }

    // Activate the game
    await supabase
      .from("game_instances")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", game_instance_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
