"use client";

import { useState, useCallback, useEffect } from "react";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  gameTitle: string;
  closesAt: Date | null;
  onAnswer: (optionId: string | null, displayText: string) => void;
  variant?: "song_request" | "single";
};

export function OpenEndedGame({
  uiState,
  guestId,
  gameInstanceId,
  gameTitle,
  closesAt,
  onAnswer,
  variant = "single",
}: Props) {
  const [text, setText] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [expired, setExpired] = useState(false);

  // Load the single open question (id + prompt) for this game
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("questions")
      .select("id, prompt")
      .eq("game_instance_id", gameInstanceId)
      .order("index", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setQuestionId(data.id);
          setPrompt(data.prompt);
        }
      });
  }, [gameInstanceId]);

  const handleSubmit = useCallback(async () => {
    if (!questionId) return;
    const answer =
      variant === "song_request"
        ? JSON.stringify({ song_title: songTitle, artist, note: text })
        : text;

    if (variant === "song_request" ? !songTitle.trim() : !answer.trim()) return;

    setLoading(true);
    const res = await fetch("/api/play/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        game_instance_id: gameInstanceId,
        guest_id: guestId,
        raw_answer: answer,
      }),
    });
    setLoading(false);
    if (res.ok) {
      onAnswer(null, variant === "song_request" ? songTitle : text);
      setSubmitted(true);
    }
  }, [questionId, guestId, gameInstanceId, text, songTitle, artist, variant, onAnswer]);

  if (uiState.phase === "completed") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 px-4 pb-safe pt-safe">
        <div className="text-5xl">🙏</div>
        <h2 className="text-2xl font-bold text-dark text-center">Thanks for your answer!</h2>
        <p className="text-muted-foreground text-center">The hosts will review all responses on the big screen.</p>
        <BackToLobbyButton />
      </div>
    );
  }

  // Windowed game renders in the "live" phase. Before that, show a waiting screen.
  if (uiState.phase !== "live") {
    return <WaitingLobby gameTitle={gameTitle} />;
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4 px-6 pb-safe pt-safe text-center">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-bold text-dark">Response submitted!</h2>
        <p className="text-muted-foreground">Thanks! Keep an eye on the big screen.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col pb-safe">
      <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
          {variant === "song_request" ? "Wedding Song Request" : gameTitle}
        </span>
        {closesAt && !expired && (
          <CountdownTimer closesAt={closesAt} size={56} onExpire={() => setExpired(true)} />
        )}
      </div>

      <div className="flex-1 flex flex-col px-5 gap-6">
        <p className="text-2xl font-bold text-dark leading-tight text-balance">
          {prompt || gameTitle}
        </p>

        {expired ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="text-5xl">⏰</div>
            <p className="text-dark font-semibold">Time&apos;s up!</p>
            <p className="text-muted-foreground text-sm">The hosts are reviewing answers on the screen.</p>
          </div>
        ) : variant === "song_request" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-dark block mb-1">Song title *</label>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="e.g. Wajakuya"
                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-dark
                           focus:outline-none focus:border-olive transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-dark block mb-1">Artist (optional)</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Sauti Sol"
                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-dark
                           focus:outline-none focus:border-olive transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-dark block mb-1">Why this song? (optional)</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell us why..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-dark
                           focus:outline-none focus:border-olive transition-colors resize-none"
              />
            </div>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer here..."
            rows={5}
            autoFocus
            className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-dark text-base
                       focus:outline-none focus:border-olive transition-colors resize-none"
          />
        )}
      </div>

      {!expired && (
        <div className="px-5 pt-4 pb-6">
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              !questionId ||
              (variant === "song_request" ? !songTitle.trim() : !text.trim())
            }
            className={cn(
              "w-full py-4 rounded-xl bg-olive text-white font-bold text-base",
              "active:scale-95 transition-all duration-100",
              "disabled:opacity-40 shadow-md shadow-olive/20"
            )}
          >
            {loading ? "Submitting…" : "Submit Answer →"}
          </button>
        </div>
      )}
    </div>
  );
}
