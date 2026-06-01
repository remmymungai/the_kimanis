"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGuestSession } from "@/hooks/useGuestSession";

const EVENT_SLUG = "kimanis-2026";

export default function JoinPage() {
  const router = useRouter();
  const { state, join } = useGuestSession();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (state.status === "authenticated") {
      router.replace("/play");
    }
  }, [state.status, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }
    setLoading(true);
    setError("");
    const result = await join(EVENT_SLUG, trimmed);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success, useEffect redirects to /play
  }

  if (state.status === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <div className="w-8 h-8 rounded-full border-4 border-olive border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 pt-safe pb-safe">
      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <p className="text-sm font-medium tracking-widest uppercase text-olive/70 mb-2">
          Welcome to
        </p>
        <h1 className="text-4xl font-bold text-dark leading-tight">
          Remmy &amp; Mbete&apos;s
        </h1>
        <h2 className="text-3xl font-bold text-olive mt-1">
          Engagement Party 🎉
        </h2>
        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
          Enter your name to join the party games
        </p>
      </div>

      {/* Join card */}
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 animate-fade-in"
        style={{ animationDelay: "0.15s" }}
      >
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-dark mb-2">
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Auntie Grace"
              autoComplete="given-name"
              autoFocus
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-cream text-dark
                         text-base placeholder:text-muted-foreground
                         focus:outline-none focus:border-olive transition-colors
                         disabled:opacity-50"
            />
            {error && (
              <p className="mt-2 text-sm text-destructive font-medium">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 rounded-xl bg-olive text-white font-bold text-base
                       active:scale-95 transition-all duration-100
                       disabled:opacity-40 disabled:scale-100
                       shadow-md shadow-olive/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Joining...
              </span>
            ) : (
              "Join the Party →"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed">
          If you leave and come back, just enter the same name to rejoin your session.
        </p>
      </div>

      {/* Branding footer */}
      <p className="mt-10 text-xs text-muted-foreground text-center animate-fade-in"
         style={{ animationDelay: "0.3s" }}>
        💍 June 2026
      </p>
    </main>
  );
}
