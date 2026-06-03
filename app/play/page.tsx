"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGuestSession } from "@/hooks/useGuestSession";
import { createClient } from "@/lib/supabase/client";
import { SESSION_CHANNEL } from "@/lib/games";

export default function LobbyPage() {
  const router = useRouter();
  const { state } = useGuestSession();

  useEffect(() => {
    if (state.status !== "authenticated") return;

    const supabase = createClient();

    // Jump into whatever game is currently live (on mount + as a poll fallback)
    async function checkActive() {
      const { data } = await supabase
        .from("game_instances")
        .select("id")
        .in("status", ["active", "question_open", "question_closed"])
        .order("activated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) router.replace(`/play/${data.id}`);
    }

    checkActive();
    const poll = setInterval(checkActive, 4000);

    // Listen for game activation broadcast (session-wide channel)
    const channel = supabase
      .channel(SESSION_CHANNEL)
      .on("broadcast", { event: "game_event" }, (payload) => {
        const msg = payload.payload;
        if (msg.type === "GAME_STATE_CHANGE" && msg.new_status === "active") {
          router.replace(`/play/${msg.game_instance_id}`);
        }
      })
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [state.status, router]);

  const guestName =
    state.status === "authenticated" ? state.guest.display_name : "Guest";

  return (
    <main className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 pt-safe pb-safe">
      <div className="text-center space-y-6 animate-slide-up">
        {/* Ring emoji as placeholder logo */}
        <div className="text-7xl">💍</div>

        <div>
          <h1 className="text-3xl font-bold text-dark">Welcome, {guestName}!</h1>
          <p className="text-muted-foreground mt-2 text-base">
            You&apos;re in the party. The next game will start soon!
          </p>
        </div>

        {/* Pulsing waiting indicator */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <div className="w-2.5 h-2.5 rounded-full bg-olive animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2.5 h-2.5 rounded-full bg-olive animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2.5 h-2.5 rounded-full bg-olive animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>

        <p className="text-sm text-muted-foreground">
          Waiting for the host to start a game...
        </p>
      </div>
    </main>
  );
}
