"use client";

import { useCallback } from "react";
import { QuestionPrompt } from "@/components/shared/QuestionPrompt";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { AnswerSubmitted } from "@/components/shared/AnswerSubmitted";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { ScoreReveal } from "@/components/shared/ScoreReveal";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  gameTitle: string;
  onAnswer: (optionId: string | null, displayText: string) => void;
};

const CHOICE_STYLES = [
  { bg: "bg-olive", text: "text-white", activeBg: "active:bg-olive/80" },
  { bg: "bg-blush", text: "text-white", activeBg: "active:bg-blush/80" },
];

export function WhoSaidWhatGame({ uiState, guestId, gameInstanceId, gameTitle, onAnswer }: Props) {
  const handleChoiceClick = useCallback(
    async (optionId: string, optionText: string) => {
      if (uiState.phase !== "question") return;
      // Optimistically update UI before awaiting network
      onAnswer(optionId, optionText);
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

  if (uiState.phase === "waiting" || uiState.phase === "live") {
    return <WaitingLobby gameTitle={gameTitle} />;
  }

  if (uiState.phase === "question") {
    const { question, closesAt } = uiState;
    const options = question.options ?? [];

    return (
      <div className="flex flex-col min-h-dvh bg-cream pb-safe">
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
            Who Said What?
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
        {uiState.closesAt && <CountdownTimer closesAt={uiState.closesAt} size={56} />}
      </div>
    );
  }

  if (uiState.phase === "result") {
    const correctText = uiState.correctOptionId
      ? uiState.question.options?.find(o => o.id === uiState.correctOptionId)?.text
      : undefined;

    return (
      <div className="min-h-dvh bg-cream flex flex-col overflow-y-auto pb-safe">
        <div className="flex-shrink-0">
          <ScoreReveal
            pointsAwarded={uiState.myPoints}
            isCorrect={uiState.myIsCorrect}
            correctAnswer={correctText}
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
        <BackToLobbyButton />
      </div>
    );
  }

  return null;
}
