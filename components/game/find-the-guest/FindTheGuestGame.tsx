"use client";

import { useState, useEffect, useCallback } from "react";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { GameUIState } from "@/hooks/useGameState";
import type { Question } from "@/types";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  onAnswer: (optionId: string | null, displayText: string) => void;
  closesAt: Date | null;
};

type BingoCell = {
  question: Question;
  answered: boolean;
  correct: boolean | null;
};

export function FindTheGuestGame({ uiState, guestId, gameInstanceId, onAnswer, closesAt }: Props) {
  const [cells, setCells] = useState<BingoCell[]>([]);
  const [activeCell, setActiveCell] = useState<BingoCell | null>(null);
  const [loading, setLoading] = useState(false);

  // Load all questions for this game instance
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("questions")
      .select("*")
      .eq("game_instance_id", gameInstanceId)
      .order("index")
      .then(({ data }) => {
        if (data) {
          setCells(
            data.map((q) => ({
              question: q as Question,
              answered: false,
              correct: null,
            }))
          );
        }
      });
  }, [gameInstanceId]);

  const handleOptionSelect = useCallback(
    async (cell: BingoCell, optionId: string, optionText: string) => {
      setLoading(true);
      const res = await fetch("/api/play/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: cell.question.id,
          game_instance_id: gameInstanceId,
          guest_id: guestId,
          raw_answer: optionId,
        }),
      });

      const isCorrect = optionId === cell.question.correct_option_id;
      setCells((prev) =>
        prev.map((c) =>
          c.question.id === cell.question.id
            ? { ...c, answered: true, correct: isCorrect }
            : c
        )
      );
      setActiveCell(null);
      onAnswer(optionId, optionText);
      setLoading(false);
    },
    [guestId, gameInstanceId, onAnswer]
  );

  if (uiState.phase === "waiting") return <WaitingLobby message="Find the Guest is starting! Get ready to mingle!" />;

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

  return (
    <div className="min-h-dvh bg-cream flex flex-col pb-safe">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70 block">
            Find the Guest
          </span>
          <span className="text-sm text-muted-foreground">
            {cells.filter((c) => c.answered).length}/{cells.length} found
          </span>
        </div>
        {closesAt && <CountdownTimer closesAt={closesAt} size={64} />}
      </div>

      {/* Bingo grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {cells.map((cell) => (
            <button
              key={cell.question.id}
              onClick={() => !cell.answered && setActiveCell(cell)}
              disabled={cell.answered}
              className={cn(
                "rounded-2xl p-4 text-left border-2 transition-all min-h-[80px]",
                "active:scale-95 duration-100",
                cell.answered && cell.correct
                  ? "bg-sage/20 border-sage text-sage"
                  : cell.answered && !cell.correct
                  ? "bg-muted border-border text-muted-foreground"
                  : "bg-white border-border text-dark hover:border-olive"
              )}
            >
              <span className="text-sm font-semibold leading-snug">
                {cell.answered && cell.correct ? "✓ " : ""}
                {cell.question.prompt}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Option overlay */}
      {activeCell && (
        <div className="fixed inset-0 bg-dark/60 flex items-end z-50" onClick={() => setActiveCell(null)}>
          <div
            className="w-full bg-white rounded-t-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-dark mb-1 text-balance">
              {activeCell.question.prompt}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              Who fits this description?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(activeCell.question.options ?? []).map((opt) => (
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
