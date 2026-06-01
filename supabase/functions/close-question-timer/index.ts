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
    const { game_instance_id, question_id, question_index, delay_ms } = await req.json();

    // Wait for the question timer to expire
    await new Promise((resolve) => setTimeout(resolve, delay_ms));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify question is still open (admin may have manually closed it)
    const { data: game } = await supabase
      .from("game_instances")
      .select("status, current_question_index")
      .eq("id", game_instance_id)
      .single();

    if (game?.status !== "question_open" || game.current_question_index !== question_index) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Close the question
    await supabase
      .from("game_instances")
      .update({ status: "question_closed" })
      .eq("id", game_instance_id);

    // Trigger scoring
    const scoreUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/score-question`;
    await fetch(scoreUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ game_instance_id, question_id, question_index }),
    });

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
