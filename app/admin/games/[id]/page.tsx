"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GAME_TYPE_LABELS } from "@/types/game-config";
import { isWindowed, OPEN_REVIEW_GAMES } from "@/lib/games";
import { cn } from "@/lib/utils";
import type { GameInstance, Question } from "@/types";

export default function GameControlPage() {
  const params = useParams();
  const gameId = params?.id as string;
  const router = useRouter();

  const [game, setGame] = useState<GameInstance | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [guestCount, setGuestCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const refreshGame = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("game_instances")
      .select("*")
      .eq("id", gameId)
      .single();
    if (data) setGame(data as GameInstance);
    return data as GameInstance | null;
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    const supabase = createClient();

    // Initial load
    Promise.all([
      supabase.from("game_instances").select("*").eq("id", gameId).single(),
      supabase.from("questions").select("id", { count: "exact", head: true }).eq("game_instance_id", gameId),
      supabase.from("guests").select("id", { count: "exact", head: true }),
    ]).then(([{ data: g }, { count: qc }, { count: gc }]) => {
      if (g) setGame(g as GameInstance);
      setTotalQuestions(qc ?? 0);
      setGuestCount(gc ?? 0);
      setLoading(false);
    });

    // Live answer count via Broadcast (no CDC table setup needed)
    const sub = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "game_event" }, (payload) => {
        const msg = payload.payload;
        if (msg.type === "ANSWER_RECEIVED") {
          setAnswerCount((c) => c + 1);
        }
        if (msg.type === "QUESTION_REVEAL") {
          setAnswerCount(0);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [gameId]);

  // Fetch current question when game updates
  useEffect(() => {
    if (!game || game.status === "pending" || game.status === "completed") {
      setQuestion(null);
      setAnswerCount(0);
      return;
    }
    const supabase = createClient();
    supabase
      .from("questions")
      .select("*")
      .eq("game_instance_id", gameId)
      .eq("index", game.current_question_index)
      .single()
      .then(({ data }) => {
        if (data) {
          setQuestion(data as Question);
          setAnswerCount(0); // Reset count for new question
        }
      });
  }, [game?.status, game?.current_question_index, gameId]);

  async function callApi(path: string, method = "POST") {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(path, { method });
      const json = await res.json();
      if (!res.ok) setActionError(json.error ?? "Something went wrong");
      else await refreshGame();
    } catch {
      setActionError("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!game) return null;

  const windowed = isWindowed(game.game_type);
  // Is there another question to show after the current state?
  const hasNextQuestion =
    game.status === "active"
      ? totalQuestions > 0 && game.current_question_index < totalQuestions
      : game.status === "question_closed"
      ? game.current_question_index + 1 < totalQuestions
      : false;
  const isLastClosed =
    game.status === "question_closed" && game.current_question_index + 1 >= totalQuestions;

  return (
    <main className="min-h-dvh bg-dark text-white pb-8">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <button onClick={() => router.back()} className="text-white/60 text-sm">← Back</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate">{game.title}</h1>
          <p className="text-white/50 text-xs">{GAME_TYPE_LABELS[game.game_type]}</p>
        </div>
        <a
          href={`/admin/games/${gameId}/qrcode`}
          className="px-3 py-1.5 border border-white/20 rounded-xl text-xs text-white/60"
        >
          QR Code
        </a>
      </header>

      <div className="p-5 space-y-6 max-w-lg mx-auto">
        {actionError && (
          <p className="text-blush text-sm font-medium bg-blush/10 rounded-xl px-4 py-3">{actionError}</p>
        )}

        {/* Status card */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Status</span>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold",
              game.status === "question_open" ? "bg-gold/20 text-gold animate-pulse" :
              game.status === "active" ? "bg-sage/20 text-sage" :
              game.status === "completed" ? "bg-muted text-muted-foreground" :
              "bg-white/10 text-white/60"
            )}>
              {game.status.replace(/_/g, " ")}
            </span>
          </div>

          {/* Current question */}
          {question && (
            <div className="mb-4">
              <p className="text-xs text-white/50 mb-1">
                Question {game.current_question_index + 1} of {totalQuestions}
              </p>
              <p className="text-white font-medium text-balance">{question.prompt}</p>
            </div>
          )}

          {/* Answer progress (per-question games while a question is open) */}
          {game.status === "question_open" && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-white/60">Answers received</span>
                <span className="font-bold text-gold">{answerCount} / {guestCount}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all"
                  style={{ width: guestCount > 0 ? `${Math.min(100, (answerCount / guestCount) * 100)}%` : "0%" }}
                />
              </div>
            </div>
          )}

          {/* Live submissions count for windowed games */}
          {windowed && game.status === "active" && (
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-white/60">Submissions so far</span>
              <span className="font-bold text-gold">{answerCount}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {game.status === "pending" && (
              <button
                onClick={() => callApi(`/api/admin/games/${gameId}/activate`)}
                disabled={actionLoading}
                className="w-full py-4 bg-sage text-white rounded-xl font-bold text-base
                           active:scale-95 transition-all disabled:opacity-40"
              >
                {actionLoading ? "Starting…" : "▶ Start Game"}
              </button>
            )}

            {/* Per-question games: show next question when one remains */}
            {!windowed && hasNextQuestion && (
              <button
                onClick={() => callApi(`/api/admin/games/${gameId}/question`)}
                disabled={actionLoading}
                className="w-full py-4 bg-gold text-dark rounded-xl font-bold text-base
                           active:scale-95 transition-all disabled:opacity-40"
              >
                {actionLoading ? "Opening…" : `▶ Show Question ${(game.status === "question_closed" ? game.current_question_index + 2 : game.current_question_index + 1)} of ${totalQuestions}`}
              </button>
            )}

            {game.status === "question_open" && (
              <button
                onClick={() => callApi(`/api/admin/games/${gameId}/question`, "DELETE")}
                disabled={actionLoading}
                className="w-full py-4 bg-blush text-white rounded-xl font-bold text-base
                           active:scale-95 transition-all disabled:opacity-40"
              >
                {actionLoading ? "Closing…" : "⏹ Close Question & Score"}
              </button>
            )}

            {isLastClosed && (
              <p className="text-center text-xs text-white/40">That was the last question.</p>
            )}

            {/* End Game — available for windowed (while active) and per-question (active/closed) */}
            {(game.status === "active" || game.status === "question_closed") && (
              <button
                onClick={() => callApi(`/api/admin/games/${gameId}/complete`)}
                disabled={actionLoading}
                className={cn(
                  "w-full rounded-xl font-bold transition-all active:scale-95 disabled:opacity-40",
                  isLastClosed || windowed
                    ? "py-4 bg-gold text-dark text-base"
                    : "py-3 border border-white/20 text-white/60 text-sm font-semibold"
                )}
              >
                {actionLoading ? "Ending…" : windowed ? "⏹ End Game & Show Results" : "End Game"}
              </button>
            )}

            {game.status === "completed" && (
              <div className="text-center py-4">
                <p className="text-white/50">Game completed! 🎉</p>
              </div>
            )}

            {["pending", "completed"].includes(game.status) && (
              <button
                onClick={async () => {
                  if (!window.confirm(`Delete "${game.title}"? This cannot be undone.`)) return;
                  setActionLoading(true);
                  const res = await fetch(`/api/admin/games/${gameId}`, { method: "DELETE" });
                  if (res.ok) router.replace("/admin/dashboard");
                  else {
                    const { error } = await res.json();
                    setActionError(error ?? "Failed to delete game.");
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                className="w-full py-3 text-blush/60 text-sm font-medium hover:text-blush transition-colors
                           disabled:opacity-40"
              >
                🗑 Delete this game
              </button>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          {game.game_type === "confessions_wall" && (
            <>
              <a href={`/admin/games/${gameId}/moderate`}
                className="block w-full py-3 text-center bg-white/10 rounded-xl text-white text-sm font-semibold">
                🛡 Moderate Confessions
              </a>
              <a href={`/wall?game=${gameId}`} target="_blank" rel="noreferrer"
                className="block w-full py-3 text-center border border-white/20 rounded-xl text-white/60 text-sm">
                Open Confessions Wall ↗
              </a>
            </>
          )}

          {OPEN_REVIEW_GAMES.includes(game.game_type) && (
            <a href={`/display/${gameId}`} target="_blank" rel="noreferrer"
              className="block w-full py-3 text-center bg-white/10 rounded-xl text-white text-sm font-semibold">
              📺 Open Answers Display ↗
            </a>
          )}

          {game.game_type === "finish_the_sentence" && (
            <a href={`/display/${gameId}`} target="_blank" rel="noreferrer"
              className="block w-full py-3 text-center bg-white/10 rounded-xl text-white text-sm font-semibold">
              📺 Open Answers Display (open questions) ↗
            </a>
          )}

          <a href="/admin/lobby"
            className="block w-full py-3 text-center border border-white/20 rounded-xl text-white/60 text-sm">
            👥 Guest Lobby &amp; Scores
          </a>
        </div>
      </div>
    </main>
  );
}
