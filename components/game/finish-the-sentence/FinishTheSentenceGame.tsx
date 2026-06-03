"use client";

import { useState, useCallback } from "react";
import { TriviaGame } from "@/components/game/trivia/TriviaGame";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  gameTitle: string;
  onAnswer: (optionId: string | null, displayText: string) => void;
};

const HEADER = "Finish the Sentence";

export function FinishTheSentenceGame({ uiState, guestId, gameInstanceId, gameTitle, onAnswer }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const questionType =
    uiState.phase === "question" || uiState.phase === "answer_submitted" || uiState.phase === "result"
      ? uiState.question.question_type
      : null;

  const submitOpen = useCallback(async () => {
    if (uiState.phase !== "question" || !text.trim()) return;
    setLoading(true);
    await fetch("/api/play/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: uiState.question.id,
        game_instance_id: gameInstanceId,
        guest_id: guestId,
        raw_answer: text.trim(),
      }),
    });
    onAnswer(null, text.trim());
    setText("");
    setLoading(false);
  }, [uiState, guestId, gameInstanceId, text, onAnswer]);

  // Choice questions reuse the full Trivia experience (timer, score reveal, leaderboard).
  if (questionType === "choice") {
    return (
      <TriviaGame
        uiState={uiState}
        guestId={guestId}
        gameInstanceId={gameInstanceId}
        gameTitle={gameTitle}
        headerLabel={HEADER}
        onAnswer={onAnswer}
      />
    );
  }

  if (uiState.phase === "waiting" || uiState.phase === "live") {
    return <WaitingLobby gameTitle={gameTitle} />;
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

  // Open (unscored) question — guest types a free answer, reviewed on the big screen.
  if (uiState.phase === "question") {
    const { question, closesAt } = uiState;
    return (
      <div className="min-h-dvh bg-cream flex flex-col pb-safe">
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">{HEADER}</span>
          {closesAt && <CountdownTimer closesAt={closesAt} />}
        </div>
        <div className="flex-1 flex flex-col px-5 gap-5 pt-2">
          <p className="text-2xl font-bold text-dark leading-tight text-balance">{question.prompt}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Finish it your way…"
            rows={4}
            autoFocus
            className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-dark text-base
                       focus:outline-none focus:border-olive transition-colors resize-none"
          />
        </div>
        <div className="px-5 pt-4 pb-6">
          <button
            onClick={submitOpen}
            disabled={loading || !text.trim()}
            className={cn(
              "w-full py-4 rounded-xl bg-olive text-white font-bold text-base",
              "active:scale-95 transition-all duration-100 disabled:opacity-40 shadow-md shadow-olive/20"
            )}
          >
            {loading ? "Submitting…" : "Submit Answer →"}
          </button>
        </div>
      </div>
    );
  }

  if (uiState.phase === "answer_submitted") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-bold text-dark">Answer submitted!</h2>
        <p className="text-muted-foreground text-sm">Look up at the big screen 👀</p>
      </div>
    );
  }

  // Open question result — answers are reviewed on the projector
  if (uiState.phase === "result") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4 px-6 text-center pb-safe pt-safe">
        <div className="text-5xl">📺</div>
        <h2 className="text-2xl font-bold text-dark">Answers are in!</h2>
        <p className="text-muted-foreground">The hosts are reading them out on the big screen.</p>
        {uiState.top10.length > 0 && (
          <div className="w-full pt-4">
            <Leaderboard entries={uiState.top10} highlightGuestId={guestId} />
          </div>
        )}
      </div>
    );
  }

  return null;
}
