"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGuestSession } from "@/hooks/useGuestSession";
import { createClient } from "@/lib/supabase/client";
import { GameDispatcher } from "@/components/game/GameDispatcher";
import type { GameInstance } from "@/types";

export default function GamePage() {
  const params = useParams();
  const gameId = params?.gameId as string;
  const router = useRouter();
  const { state } = useGuestSession();
  const [game, setGame] = useState<GameInstance | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gameId) return;

    const supabase = createClient();
    supabase
      .from("game_instances")
      .select("*")
      .eq("id", gameId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Game not found");
          return;
        }
        setGame(data as GameInstance);
      });
  }, [gameId]);

  if (state.status === "loading" || !game) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <div className="w-8 h-8 rounded-full border-4 border-olive border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-cream px-6">
        <p className="text-destructive font-medium">{error}</p>
        <button
          onClick={() => router.replace("/play")}
          className="px-6 py-3 bg-olive text-white rounded-xl font-semibold"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (state.status !== "authenticated") return null;

  return <GameDispatcher game={game} guestId={state.guest.id} />;
}
