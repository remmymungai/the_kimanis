"use client";

import { useCallback } from "react";
import { TriviaGame } from "@/components/game/trivia/TriviaGame";
import { OpenEndedGame } from "@/components/game/open-ended/OpenEndedGame";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  onAnswer: (answer: string) => void;
};

export function FinishTheSentenceGame({ uiState, guestId, gameInstanceId, onAnswer }: Props) {
  // The question_type on the question row determines which UI to render
  const questionType =
    uiState.phase === "question" || uiState.phase === "answer_submitted"
      ? uiState.question.question_type
      : null;

  if (questionType === "choice") {
    return (
      <TriviaGame
        uiState={uiState}
        guestId={guestId}
        gameInstanceId={gameInstanceId}
        onAnswer={onAnswer}
      />
    );
  }

  return (
    <OpenEndedGame
      uiState={uiState}
      guestId={guestId}
      gameInstanceId={gameInstanceId}
      onAnswer={onAnswer}
      variant="single"
    />
  );
}
