"use client";

import { useCallback } from "react";
import { QuestionPrompt } from "@/components/shared/QuestionPrompt";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { AnswerSubmitted } from "@/components/shared/AnswerSubmitted";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  onAnswer: (answer: string) => void;
};

const OPTION_STYLES = [
  "bg-[#E63946] text-white",
  "bg-[#2A9D8F] text-white",
  "bg-[#E9C46A] text-dark",
  "bg-[#457B9D] text-white",
];

export function TriviaGame({ uiState, guestId, gameInstanceId, onAnswer }: Props) {
  const handleChoiceClick = useCallback(
    async (optionId: string, optionText: string) => {
      onAnswer(optionText);
      if (uiState.phase !== "question") return;
      await fetch("/api/play/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: uiState.question.id,
          game_instance_id: gameInstanceId,
          guest_id: guestId,
          raw_answer: optionId,
        }),
      });
    },
    [uiState, guestId, gameInstanceId, onAnswer]
  );

  if (uiState.phase === "waiting") return <WaitingLobby />;

  if (uiState.phase === "question") {
    const { question, closesAt } = uiState;
    const options = question.options ?? [];

    return (
      <div className="flex flex-col min-h-dvh bg-cream pb-safe">
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
            Know the Couple?
          </span>
          {closesAt && <CountdownTimer closesAt={closesAt} />}
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-4">
          <QuestionPrompt
            prompt={question.prompt}
            questionNumber={question.index + 1}
            totalQuestions={question.total_questions || undefined}
            mediaUrl={question.media_url}
          />
        </div>

        {/* 2×2 Kahoot-style grid */}
        <div className="px-4 pb-6 grid grid-cols-2 gap-3">
          {options.slice(0, 4).map((opt, i) => (
            <button
              key={opt.id}
              onClick={() => handleChoiceClick(opt.id, opt.text)}
              className={cn(
                "rounded-2xl py-6 px-3 text-base font-bold shadow-md text-center leading-tight",
                "transition-all duration-100 active:scale-95",
                OPTION_STYLES[i] ?? OPTION_STYLES[0]
              )}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (uiState.phase === "answer_submitted") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center">
        <AnswerSubmitted answer={uiState.answer} />
        {uiState.closesAt && <CountdownTimer closesAt={uiState.closesAt} size={56} />}
      </div>
    );
  }

  if (uiState.phase === "result") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col overflow-y-auto pb-safe pt-safe">
        <div className="px-4 pt-6 pb-4 text-center">
          {uiState.correctOptionId && (
            <p className="text-sm text-muted-foreground mb-1">
              Answer: <span className="font-bold text-dark">
                {uiState.question.options?.find(o => o.id === uiState.correctOptionId)?.text}
              </span>
            </p>
          )}
        </div>
        {uiState.top10.length > 0 && (
          <div className="px-4 pb-8">
            <Leaderboard entries={uiState.top10} highlightGuestId={guestId} />
          </div>
        )}
      </div>
    );
  }

  if (uiState.phase === "completed") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 px-4 pb-safe pt-safe">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-dark text-center">Game Over!</h2>
        <Leaderboard entries={uiState.finalLeaderboard} highlightGuestId={guestId} title="Final Scores" />
      </div>
    );
  }

  return null;
}
