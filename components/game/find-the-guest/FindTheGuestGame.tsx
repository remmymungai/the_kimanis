"use client";

import { useState, useEffect, useCallback } from "react";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { GameUIState } from "@/hooks/useGameState";
import type { GameStatus } from "@/types/game-config";
import type { Question } from "@/types";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  gameTitle: string;
  gameStatus: GameStatus;
  closesAt: Date | null;
  onAnswer: (optionId: string | null, displayText: string) => void;
};

type BingoCell = {
  question: Question;
  answered: boolean;
};

export function FindTheGuestGame({
  uiState,
  guestId,
  gameInstanceId,
  gameTitle,
  closesAt,
  onAnswer,
}: Props) {
  const [cells, setCells] = useState<BingoCell[]>([]);
  const [activeCell, setActiveCell] = useState<BingoCell | null>(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("questions")
      .select("*")
      .eq("game_instance_id", gameInstanceId)
      .order("index")
      .then(({ data }) => {
        if (data) {
          setCells(data.map((q) => ({ question: q as Question, answered: false })));
        }
      });
  }, [gameInstanceId]);

  const handleOptionSelect = useCallback(
    async (cell: BingoCell, optionId: string, optionText: string) => {
      setLoading(true);
      await fetch("/api/play/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: cell.question.id,
          game_instance_id: gameInstanceId,
          guest_id: guestId,
          raw_answer: optionId,
        }),
      });
      // Mark answered (neutral — correctness is revealed at the end, no spoilers)
      setCells((prev) =>
        prev.map((c) => (c.question.id === cell.question.id ? { ...c, answered: true } : c))
      );
      setActiveCell(null);
      onAnswer(optionId, optionText);
      setLoading(false);
    },
    [guestId, gameInstanceId, onAnswer]
  );

  if (uiState.phase === "completed") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 px-4 pb-safe pt-safe">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-dark text-center">Time&apos;s Up!</h2>
        <Leaderboard entries={uiState.finalLeaderboard} highlightGuestId={guestId} title="Final Scores" />
        <BackToLobbyButton />
      </div>
    );
  }

  if (uiState.phase !== "live") {
    return <WaitingLobby gameTitle={gameTitle} />;
  }

  const answeredCount = cells.filter((c) => c.answered).length;

  return (
    <div className="min-h-dvh bg-cream flex flex-col pb-safe">
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70 block">
            {gameTitle}
          </span>
          <span className="text-sm text-muted-foreground">
            {answeredCount}/{cells.length} answered
          </span>
        </div>
        {closesAt && !expired && (
          <CountdownTimer closesAt={closesAt} size={64} onExpire={() => setExpired(true)} />
        )}
      </div>

      {expired ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-5xl">⏰</div>
          <p className="text-dark font-semibold text-lg">Time&apos;s up!</p>
          <p className="text-muted-foreground text-sm">Waiting for the final leaderboard on the big screen…</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {cells.map((cell) => (
              <button
                key={cell.question.id}
                onClick={() => !cell.answered && setActiveCell(cell)}
                disabled={cell.answered}
                className={cn(
                  "rounded-2xl p-4 text-left border-2 transition-all min-h-[80px] active:scale-95 duration-100",
                  cell.answered
                    ? "bg-sage/15 border-sage/40 text-sage"
                    : "bg-white border-border text-dark hover:border-olive"
                )}
              >
                <span className="text-sm font-semibold leading-snug">
                  {cell.answered ? "✓ " : ""}
                  {cell.question.prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeCell && (
        <div className="fixed inset-0 bg-dark/60 flex items-end z-50" onClick={() => setActiveCell(null)}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-safe" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-dark mb-1 text-balance">{activeCell.question.prompt}</p>
            <p className="text-sm text-muted-foreground mb-5">Who fits this description?</p>
            <div className="grid grid-cols-2 gap-3">
              {(activeCell.question.options ?? [])
                .filter((opt) => opt.text.trim().length > 0)
                .map((opt) => (
                  <button
                    key={opt.id}
                    disabled={loading}
                    onClick={() => handleOptionSelect(activeCell, opt.id, opt.text)}
                    className="rounded-xl py-4 bg-cream border-2 border-border text-dark font-semibold
                               active:scale-95 transition-all duration-100 active:bg-olive/10 active:border-olive"
                  >
                    {opt.text}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setActiveCell(null)}
              className="w-full mt-4 py-3 text-muted-foreground text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
