"use client";

import { useCallback } from "react";
import { QuestionPrompt } from "@/components/shared/QuestionPrompt";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { AnswerSubmitted } from "@/components/shared/AnswerSubmitted";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { ScoreReveal } from "@/components/shared/ScoreReveal";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";
import type { LeaderboardEntry } from "@/types/realtime";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  onAnswer: (answer: string) => void;
  leaderboard?: LeaderboardEntry[];
};

// Who Said What always has exactly 2 options: Remmy or Mbete
const CHOICE_STYLES = [
  { bg: "bg-olive", text: "text-white", activeBg: "active:bg-olive/80" },
  { bg: "bg-blush", text: "text-white", activeBg: "active:bg-blush/80" },
];

export function WhoSaidWhatGame({ uiState, guestId, gameInstanceId, onAnswer, leaderboard }: Props) {
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

  if (uiState.phase === "waiting") {
    return <WaitingLobby message="Who Said What is starting..." />;
  }

  if (uiState.phase === "question") {
    const { question, closesAt } = uiState;
    const options = question.options ?? [];

    return (
      <div className="flex flex-col min-h-dvh bg-cream pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
            Who Said What?
          </span>
          {closesAt && <CountdownTimer closesAt={closesAt} />}
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center px-6 py-4">
          <QuestionPrompt
            prompt={question.prompt}
            questionNumber={question.index + 1}
            totalQuestions={question.total_questions || undefined}
            mediaUrl={question.media_url}
          />
        </div>

        {/* Two big choice buttons */}
        <div className="px-5 pb-6 grid grid-cols-2 gap-4">
          {options.slice(0, 2).map((opt, i) => {
            const style = CHOICE_STYLES[i] ?? CHOICE_STYLES[0];
            return (
              <button
                key={opt.id}
                onClick={() => handleChoiceClick(opt.id, opt.text)}
                className={cn(
                  "rounded-2xl py-8 text-xl font-bold shadow-lg",
                  "transition-all duration-100 active:scale-95",
                  style.bg, style.text, style.activeBg
                )}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (uiState.phase === "answer_submitted") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center">
        <AnswerSubmitted answer={uiState.answer} />
        {uiState.closesAt && (
          <CountdownTimer closesAt={uiState.closesAt} size={56} />
        )}
      </div>
    );
  }

  if (uiState.phase === "result") {
    const myAnswer = leaderboard?.find((e) => e.guest_id === guestId);
    const isCorrect = uiState.correctOptionId !== null
      ? uiState.question.options?.find(o => o.id === uiState.correctOptionId)?.text !== undefined
      : null;

    return (
      <div className="min-h-dvh bg-cream flex flex-col overflow-y-auto pb-safe">
        <div className="flex-shrink-0">
          <ScoreReveal
            pointsAwarded={myAnswer ? 0 : 0} // actual points from leaderboard diff
            isCorrect={null}
            className="pt-safe"
          />
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
