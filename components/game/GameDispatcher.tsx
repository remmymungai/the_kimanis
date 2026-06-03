"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { useGameState } from "@/hooks/useGameState";
import { WhoSaidWhatGame } from "./who-said-what/WhoSaidWhatGame";
import { TriviaGame } from "./trivia/TriviaGame";
import { OpenEndedGame } from "./open-ended/OpenEndedGame";
import { PriceIsRightGame } from "./price-is-right/PriceIsRightGame";
import { FindTheGuestGame } from "./find-the-guest/FindTheGuestGame";
import { FinishTheSentenceGame } from "./finish-the-sentence/FinishTheSentenceGame";
import { ConfessionsGame } from "./confessions-wall/ConfessionsGame";
import type { GameInstance } from "@/types";

type Props = {
  game: GameInstance;
  guestId: string;
};

export function GameDispatcher({ game, guestId }: Props) {
  const router = useRouter();
  const { uiState, handleMessage, submitAnswer } = useGameState(game.id);

  useGameChannel({
    gameInstanceId: game.id,
    // Bind guestId so QUESTION_CLOSED can look up this player's score
    onMessage: (msg) => handleMessage(msg, guestId),
  });

  // Auto-redirect to lobby 8 seconds after game completes
  useEffect(() => {
    if (uiState.phase !== "completed") return;
    const t = setTimeout(() => router.replace("/play"), 8000);
    return () => clearTimeout(t);
  }, [uiState.phase, router]);

  // Find the Guest: derive closesAt from game config
  const findGuestClosesAt =
    game.game_type === "find_the_guest" && game.activated_at
      ? new Date(
          new Date(game.activated_at).getTime() +
          ((game.config as { window_minutes?: number }).window_minutes ?? 15) * 60 * 1000
        )
      : null;

  const commonProps = { guestId, gameInstanceId: game.id, onAnswer: submitAnswer, uiState };

  switch (game.game_type) {
    case "who_said_what":
      return <WhoSaidWhatGame {...commonProps} />;

    case "trivia":
      return <TriviaGame {...commonProps} />;

    case "finish_the_sentence":
      return <FinishTheSentenceGame {...commonProps} />;

    case "price_is_right":
      return <PriceIsRightGame {...commonProps} />;

    case "find_the_guest":
      return <FindTheGuestGame {...commonProps} closesAt={findGuestClosesAt} />;

    case "song_request":
      return <OpenEndedGame {...commonProps} variant="song_request" />;

    case "marriage_advice":
      return <OpenEndedGame {...commonProps} variant="single" />;

    case "confessions_wall":
      return <ConfessionsGame uiState={uiState} gameInstanceId={game.id} onAnswer={submitAnswer} />;

    default:
      return (
        <div className="min-h-dvh flex items-center justify-center bg-cream">
          <p className="text-muted-foreground">Unknown game type: {game.game_type}</p>
        </div>
      );
  }
}
