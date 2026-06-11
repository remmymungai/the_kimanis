"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OpenAnswersDisplay } from "@/components/display/OpenAnswersDisplay";
import { FinishSentenceDisplay } from "@/components/display/FinishSentenceDisplay";
import { FindTheGuestRevealDisplay } from "@/components/display/FindTheGuestRevealDisplay";
import { TriviaRevealDisplay } from "@/components/display/TriviaRevealDisplay";
import type { GameType } from "@/types/game-config";

export default function DisplayPage() {
  const params = useParams();
  const gameId = params?.gameId as string;
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [title, setTitle] = useState("Answers");

  useEffect(() => {
    if (!gameId) return;
    const supabase = createClient();
    supabase
      .from("game_instances")
      .select("title, game_type")
      .eq("id", gameId)
      .single()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title);
          setGameType(data.game_type as GameType);
        }
      });
  }, [gameId]);

  if (!gameType) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  switch (gameType) {
    case "find_the_guest":
      return <FindTheGuestRevealDisplay gameId={gameId} title={title} />;
    case "trivia":
    case "who_said_what":
      return <TriviaRevealDisplay gameId={gameId} title={title} />;
    case "finish_the_sentence":
      return <FinishSentenceDisplay gameId={gameId} title={title} />;
    default:
      // song_request, marriage_advice — flat card feed of all answers
      return <OpenAnswersDisplay gameId={gameId} title={title} />;
  }
}
