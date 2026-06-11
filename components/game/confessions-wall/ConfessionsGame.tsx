"use client";

import { useState, useCallback } from "react";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { cn } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  gameTitle: string;
  closesAt: Date | null;
  onAnswer: (optionId: string | null, displayText: string) => void;
};

export function ConfessionsGame({ uiState, guestId, gameInstanceId, gameTitle, closesAt }: Props) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    const res = await fetch("/api/play/confession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_instance_id: gameInstanceId, content: text.trim(), guest_id: guestId }),
    });
    setLoading(false);
    if (res.ok) setSubmitted(true);
  }, [text, gameInstanceId, guestId]);

  if (uiState.phase === "completed") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 px-4 pb-safe pt-safe">
        <div className="text-5xl">🤫</div>
        <h2 className="text-2xl font-bold text-dark text-center">Secrets are out!</h2>
        <p className="text-muted-foreground text-center">Check the big screen for the confessions!</p>
        <BackToLobbyButton />
      </div>
    );
  }

  if (uiState.phase !== "live") {
    return <WaitingLobby gameTitle={gameTitle} />;
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4 px-6 pb-safe pt-safe text-center">
        <div className="text-6xl">🙊</div>
        <h2 className="text-2xl font-bold text-dark">Confession submitted!</h2>
        <p className="text-muted-foreground text-sm">
          Once approved by the hosts, it&apos;ll appear on the big screen.
        </p>
        <button
          onClick={() => { setText(""); setSubmitted(false); }}
          className="mt-2 px-6 py-3 rounded-xl border-2 border-olive text-olive font-semibold text-sm active:scale-95 transition-all"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col pb-safe">
      <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
          Confessions Wall
        </span>
        {closesAt && !expired && (
          <CountdownTimer closesAt={closesAt} size={56} onExpire={() => setExpired(true)} />
        )}
      </div>

      <div className="flex-1 flex flex-col px-5 gap-6">
        <div>
          <p className="text-2xl font-bold text-dark leading-tight mb-2">
            🤫 Spill the tea — anonymously!
          </p>
          <p className="text-sm text-muted-foreground">
            Share your funniest memory with the couple, or confess what you <em>really</em> thought when you first met them. Your identity is safe with us 😉
          </p>
        </div>

        {expired ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="text-5xl">⏰</div>
            <p className="text-dark font-semibold">Time&apos;s up!</p>
            <p className="text-muted-foreground text-sm">Watch the big screen for the confessions.</p>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="I always thought Remmy was going to marry..."
              rows={6}
              autoFocus
              maxLength={280}
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white text-dark text-base
                         focus:outline-none focus:border-olive transition-colors resize-none"
            />
            <div className="text-right text-xs text-muted-foreground">{text.length}/280</div>
          </>
        )}
      </div>

      {!expired && (
        <div className="px-5 pt-4 pb-6">
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className={cn(
              "w-full py-4 rounded-xl bg-dark text-white font-bold text-base",
              "active:scale-95 transition-all duration-100",
              "disabled:opacity-40 shadow-md"
            )}
          >
            {loading ? "Sending…" : "Submit Anonymously 🤫"}
          </button>
        </div>
      )}
    </div>
  );
}
