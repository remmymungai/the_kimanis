"use client";

import { useState, useCallback } from "react";
import type { RealtimeMessage, QuestionPayload, LeaderboardEntry } from "@/types/realtime";
import type { GameStatus } from "@/types/game-config";

export type GameUIState =
  | { phase: "waiting" }
  | { phase: "question"; question: QuestionPayload; opensAt: Date; closesAt: Date | null }
  | { phase: "answer_submitted"; question: QuestionPayload; answer: string; closesAt: Date | null }
  | { phase: "result"; correctOptionId: string | null; correctValue?: number; top10: LeaderboardEntry[]; question: QuestionPayload }
  | { phase: "completed"; finalLeaderboard: LeaderboardEntry[] };

export function useGameState(gameInstanceId: string) {
  const [uiState, setUIState] = useState<GameUIState>({ phase: "waiting" });
  const [gameStatus, setGameStatus] = useState<GameStatus>("pending");

  const handleMessage = useCallback((msg: RealtimeMessage) => {
    switch (msg.type) {
      case "GAME_STATE_CHANGE":
        setGameStatus(msg.new_status as GameStatus);
        if (msg.new_status === "active") {
          setUIState({ phase: "waiting" });
        }
        break;

      case "QUESTION_REVEAL":
        setUIState({
          phase: "question",
          question: msg.question,
          opensAt: new Date(msg.opens_at),
          closesAt: msg.closes_at ? new Date(msg.closes_at) : null,
        });
        break;

      case "QUESTION_CLOSED":
        setUIState((prev) => {
          const question =
            prev.phase === "question" ? prev.question :
            prev.phase === "answer_submitted" ? prev.question : null;
          if (!question) return prev;
          return {
            phase: "result",
            correctOptionId: msg.correct_option_id,
            correctValue: msg.correct_value,
            top10: msg.top_10,
            question,
          };
        });
        break;

      case "GAME_COMPLETED":
        setUIState({ phase: "completed", finalLeaderboard: msg.final_leaderboard });
        break;
    }
  }, []);

  const submitAnswer = useCallback((answer: string) => {
    setUIState((prev) => {
      if (prev.phase !== "question") return prev;
      return {
        phase: "answer_submitted",
        question: prev.question,
        answer,
        closesAt: prev.closesAt,
      };
    });
  }, []);

  return { uiState, gameStatus, handleMessage, submitAnswer };
}
