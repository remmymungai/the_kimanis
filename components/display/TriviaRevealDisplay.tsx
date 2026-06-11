"use client";

import { useState, useCallback } from "react";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { cn } from "@/lib/utils";
import type { RealtimeMessage, LeaderboardEntry, QuestionOption } from "@/types/realtime";

const OPTION_COLORS = [
  "bg-gold/20 border-gold",
  "bg-olive/15 border-olive",
  "bg-blush/15 border-blush",
  "bg-sage/15 border-sage",
];

type Props = { gameId: string; title: string };

export function TriviaRevealDisplay({ gameId, title }: Props) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [options, setOptions] = useState<QuestionOption[]>([]);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [completed, setCompleted] = useState(false);

  const onMessage = useCallback((msg: RealtimeMessage) => {
    switch (msg.type) {
      case "QUESTION_REVEAL":
        setPrompt(msg.question.prompt);
        setOptions(msg.question.options ?? []);
        setCorrectId(null);
        setCompleted(false);
        break;
      case "QUESTION_CLOSED":
        setCorrectId(msg.correct_option_id);
        setLeaderboard(msg.top_10 ?? []);
        break;
      case "GAME_COMPLETED":
        setLeaderboard(msg.final_leaderboard ?? []);
        setCompleted(true);
        break;
      case "GAME_STATE_CHANGE":
        if (msg.new_status === "completed") setCompleted(true);
        break;
    }
  }, []);

  useGameChannel({ gameInstanceId: gameId, onMessage });

  // Final screen: leaderboard only.
  if (completed) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-bold text-white text-center mb-2">{title}</h1>
        <p className="text-center text-gold text-lg mb-8">🎉 Final Results</p>
        <Leaderboard entries={leaderboard} title="Final Scores" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-4xl font-bold text-white text-center">{title}</h1>
        <p className="text-white/50">Waiting for the next question…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col p-8 overflow-y-auto">
      <h1 className="text-xl font-semibold text-white/50 text-center mb-6">{title}</h1>

      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-center gap-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center text-balance">
          {prompt}
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {options.map((opt, i) => {
            const isCorrect = correctId !== null && opt.id === correctId;
            const dimmed = correctId !== null && !isCorrect;
            return (
              <div
                key={opt.id}
                className={cn(
                  "rounded-2xl border-2 p-5 text-center text-xl font-semibold transition-all",
                  isCorrect
                    ? "bg-sage text-white border-sage scale-105 shadow-xl"
                    : dimmed
                    ? "bg-white/5 text-white/40 border-white/10"
                    : cn(OPTION_COLORS[i % OPTION_COLORS.length], "text-dark")
                )}
              >
                {isCorrect && "✓ "}
                {opt.text}
              </div>
            );
          })}
        </div>

        {correctId !== null && leaderboard.length > 0 && (
          <div className="mt-4">
            <Leaderboard entries={leaderboard} title="Leaderboard" />
          </div>
        )}
      </div>
    </div>
  );
}
