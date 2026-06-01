"use client";

import { useState, useCallback } from "react";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  onAnswer: (answer: string) => void;
  /** For song_request, we collect 3 fields. For others, just 1 */
  variant?: "song_request" | "single";
};

export function OpenEndedGame({ uiState, guestId, gameInstanceId, onAnswer, variant = "single" }: Props) {
  const [text, setText] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (uiState.phase !== "question") return;
    const answer = variant === "song_request"
      ? JSON.stringify({ song_title: songTitle, artist, note: text })
      : text;

    if (!answer.trim() && variant !== "song_request") return;
    if (variant === "song_request" && !songTitle.trim()) return;

    setLoading(true);
    await fetch("/api/play/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: uiState.question.id,
        game_instance_id: gameInstanceId,
        guest_id: guestId,
        raw_answer: answer,
      }),
    });
    onAnswer(variant === "song_request" ? songTitle : text);
    setSubmitted(true);
    setLoading(false);
  }, [uiState, guestId, gameInstanceId, text, songTitle, artist, variant, onAnswer]);

  if (uiState.phase === "waiting") return <WaitingLobby />;

  if (uiState.phase === "question" || uiState.phase === "answer_submitted") {
    const question = uiState.phase === "question" ? uiState.question : uiState.question;

    return (
      <div className="min-h-dvh bg-cream flex flex-col pb-safe">
        <div className="px-5 pt-safe pt-6 pb-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
            {variant === "song_request" ? "Wedding Song Request" : "Open Question"}
          </span>
        </div>

        <div className="flex-1 flex flex-col px-5 gap-6">
          <p className="text-2xl font-bold text-dark leading-tight text-balance">
            {question.prompt}
          </p>

          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-5xl">✅</div>
              <p className="text-muted-foreground font-medium">Response submitted!</p>
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

        {!submitted && (
          <div className="px-5 pt-4 pb-6">
            <button
              onClick={handleSubmit}
              disabled={loading || (variant === "song_request" ? !songTitle.trim() : !text.trim())}
              className={cn(
                "w-full py-4 rounded-xl bg-olive text-white font-bold text-base",
                "active:scale-95 transition-all duration-100",
                "disabled:opacity-40 shadow-md shadow-olive/20"
              )}
            >
              {loading ? "Submitting..." : "Submit Answer →"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (uiState.phase === "completed") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 px-4 pb-safe pt-safe">
        <div className="text-5xl">🙏</div>
        <h2 className="text-2xl font-bold text-dark text-center">Thanks for your answer!</h2>
        <p className="text-muted-foreground text-center">The hosts will review all responses shortly.</p>
      </div>
    );
  }

  return null;
}
