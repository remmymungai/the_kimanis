"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/realtime";

type Clue = { id: string; prompt: string; answer: string };
type Option = { id: string; text: string; is_correct?: boolean };

const CARD_COLORS = [
  "bg-cream border-gold",
  "bg-white border-olive",
  "bg-blush/10 border-blush",
  "bg-sage/10 border-sage",
];

type Props = { gameId: string; title: string };

export function FindTheGuestRevealDisplay({ gameId, title }: Props) {
  const [clues, setClues] = useState<Clue[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const loadClues = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("questions")
      .select("id, prompt, options, correct_option_id")
      .eq("game_instance_id", gameId)
      .order("index", { ascending: true });

    if (data) {
      setClues(
        data.map((q) => {
          const options = (q.options as Option[] | null) ?? [];
          const correct =
            options.find((o) => o.id === q.correct_option_id) ??
            options.find((o) => o.is_correct);
          return { id: q.id, prompt: q.prompt, answer: correct?.text ?? "—" };
        })
      );
    }
  }, [gameId]);

  const loadLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("leaderboard_snapshots")
      .select("guest_id, display_name, cumulative_points, rank, question_index")
      .eq("game_instance_id", gameId)
      .order("question_index", { ascending: false })
      .order("rank", { ascending: true });

    if (!data || data.length === 0) {
      setLeaderboard([]);
      return;
    }
    const latestIndex = data[0].question_index;
    setLeaderboard(
      data
        .filter((r) => r.question_index === latestIndex)
        .map((r) => ({
          guest_id: r.guest_id,
          display_name: r.display_name,
          cumulative_points: r.cumulative_points,
          rank: r.rank,
        }))
    );
  }, [gameId]);

  useEffect(() => {
    loadClues();
    loadLeaderboard();

    const supabase = createClient();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "game_event" }, (payload) => {
        if (payload.payload.type === "GAME_COMPLETED") {
          setLeaderboard(payload.payload.final_leaderboard ?? []);
        }
      })
      .subscribe();

    const poll = setInterval(loadLeaderboard, 6000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId, loadClues, loadLeaderboard]);

  return (
    <div className="min-h-screen bg-dark p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-2">{title}</h1>
      <p className="text-center text-white/50 text-sm mb-8">And the answers are…</p>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Answer reveal */}
        <div>
          <h2 className="text-lg font-bold text-gold mb-4 text-center">Who Was Who</h2>
          <div className="space-y-3">
            {clues.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  "rounded-2xl border-2 p-4 animate-slide-up",
                  CARD_COLORS[i % CARD_COLORS.length]
                )}
              >
                <p className="text-dark/70 text-sm font-medium mb-1">{c.prompt}</p>
                <p className="text-dark text-lg font-bold">→ {c.answer}</p>
              </div>
            ))}
            {clues.length === 0 && (
              <p className="text-white/40 text-center py-8">No clues found.</p>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h2 className="text-lg font-bold text-gold mb-4 text-center">Leaderboard</h2>
          {leaderboard.length > 0 ? (
            <Leaderboard entries={leaderboard} title="Final Scores" />
          ) : (
            <p className="text-white/40 text-center py-8">
              Scores appear once the game is closed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
