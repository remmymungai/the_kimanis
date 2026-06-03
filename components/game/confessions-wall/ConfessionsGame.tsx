"use client";

import { useState, useCallback } from "react";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { BackToLobbyButton } from "@/components/shared/BackToLobbyButton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  gameInstanceId: string;
  onAnswer: (optionId: string | null, displayText: string) => void;
};

export function ConfessionsGame({ uiState, gameInstanceId, onAnswer }: Props) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);

    const supabase = createClient();
    await supabase.from("confessions").insert({
      game_instance_id: gameInstanceId,
      content: text.trim(),
    });

    onAnswer(null, text.trim());
    setSubmitted(true);
    setLoading(false);
  }, [text, gameInstanceId, onAnswer]);

  if (uiState.phase === "waiting") return <WaitingLobby message="The Confessions Wall is opening..." />;

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

  return (
    <div className="min-h-dvh bg-cream flex flex-col pb-safe">
      <div className="px-5 pt-safe pt-6 pb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
          Confessions Wall
        </span>
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

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="text-6xl">🙊</div>
            <p className="text-lg font-bold text-dark">Confession submitted!</p>
            <p className="text-muted-foreground text-center text-sm">
              Keep an eye on the big screen. It&apos;s going up on the wall!
            </p>
          </div>
        ) : (
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
        )}

        {!submitted && (
          <div className="text-right text-xs text-muted-foreground">
            {text.length}/280
          </div>
        )}
      </div>

      {!submitted && (
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
            {loading ? "Sending..." : "Submit Anonymously 🤫"}
          </button>
        </div>
      )}
    </div>
  );
}
