"use client";

import { useState, useCallback } from "react";
import type { RealtimeMessage, QuestionPayload, LeaderboardEntry } from "@/types/realtime";
import type { GameStatus } from "@/types/game-config";

export type GameUIState =
  | { phase: "waiting" }
  | { phase: "question"; question: QuestionPayload; opensAt: Date; closesAt: Date | null }
  | {
      phase: "answer_submitted";
      question: QuestionPayload;
      answer: string;
      answeredOptionId: string | null;
      closesAt: Date | null;
    }
  | {
      phase: "result";
      correctOptionId: string | null;
      correctValue?: number;
      top10: LeaderboardEntry[];
      question: QuestionPayload;
      myPoints: number;
      myIsCorrect: boolean | null;
    }
  | { phase: "completed"; finalLeaderboard: LeaderboardEntry[] };

export function useGameState(gameInstanceId: string) {
  const [uiState, setUIState] = useState<GameUIState>({ phase: "waiting" });
  const [gameStatus, setGameStatus] = useState<GameStatus>("pending");

  const handleMessage = useCallback((msg: RealtimeMessage, guestId?: string) => {
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

          // Look up this player's score from the broadcast payload
          const playerData = guestId && msg.player_points
            ? msg.player_points[guestId]
            : null;

          // If not in payload, determine correctness from submitted option vs correct option
          const submittedOptionId =
            prev.phase === "answer_submitted" ? prev.answeredOptionId : null;
          const isCorrect = playerData
            ? playerData.is_correct
            : submittedOptionId !== null && msg.correct_option_id !== null
            ? submittedOptionId === msg.correct_option_id
            : null;

          return {
            phase: "result",
            correctOptionId: msg.correct_option_id,
            correctValue: msg.correct_value,
            top10: msg.top_10,
            question,
            myPoints: playerData?.points_awarded ?? 0,
            myIsCorrect: isCorrect,
          };
        });
        break;

      case "GAME_COMPLETED":
        setUIState({ phase: "completed", finalLeaderboard: msg.final_leaderboard });
        break;
    }
  }, []);

  // submitAnswer now tracks both the display text and the raw option id
  const submitAnswer = useCallback((optionId: string | null, displayText: string) => {
    setUIState((prev) => {
      if (prev.phase !== "question") return prev;
      return {
        phase: "answer_submitted",
        question: prev.question,
        answer: displayText,
        answeredOptionId: optionId,
        closesAt: prev.closesAt,
      };
    });
  }, []);

  return { uiState, gameStatus, handleMessage, submitAnswer };
}
