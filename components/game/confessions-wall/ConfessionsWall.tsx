"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Confession = { id: string; content: string; submitted_at: string };

type Props = {
  gameInstanceId: string;
};

const CARD_COLORS = [
  "bg-cream border-gold",
  "bg-white border-olive",
  "bg-blush/10 border-blush",
  "bg-sage/10 border-sage",
];

export function ConfessionsWall({ gameInstanceId }: Props) {
  const [confessions, setConfessions] = useState<Confession[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // Load existing approved confessions
    supabase
      .from("confessions")
      .select("id, content, submitted_at")
      .eq("game_instance_id", gameInstanceId)
      .eq("is_approved", true)
      .order("submitted_at", { ascending: true })
      .then(({ data }) => {
        if (data) setConfessions(data as Confession[]);
      });

    // Live stream approved confessions via Broadcast (admin approval emits CONFESSION_LIVE)
    const channel = supabase
      .channel(`game:${gameInstanceId}`)
      .on("broadcast", { event: "game_event" }, (payload) => {
        const msg = payload.payload;
        if (msg.type === "CONFESSION_LIVE") {
          setConfessions((prev) =>
            prev.some((c) => c.id === msg.id)
              ? prev
              : [...prev, { id: msg.id, content: msg.content, submitted_at: new Date().toISOString() }]
          );
        }
      })
      .subscribe();

    // Safety poll in case a broadcast is missed
    const poll = setInterval(() => {
      supabase
        .from("confessions")
        .select("id, content, submitted_at")
        .eq("game_instance_id", gameInstanceId)
        .eq("is_approved", true)
        .order("submitted_at", { ascending: true })
        .then(({ data }) => {
          if (data) setConfessions(data as Confession[]);
        });
    }, 5000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameInstanceId]);

  return (
    <div className="min-h-screen bg-dark p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-2">🤫 Confessions Wall</h1>
      <p className="text-center text-white/50 text-sm mb-8">Anonymous confessions from your guests</p>

      <div className="columns-2 md:columns-3 gap-4 space-y-4">
        {confessions.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "break-inside-avoid rounded-2xl border-2 p-4 animate-slide-up",
              CARD_COLORS[i % CARD_COLORS.length]
            )}
            style={{ animationDelay: `${(i % 5) * 0.05}s` }}
          >
            <p className="text-dark text-sm leading-relaxed font-medium">
              &ldquo;{c.content}&rdquo;
            </p>
          </div>
        ))}
      </div>

      {confessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-6xl">🙊</span>
          <p className="text-white/50 text-center">Waiting for confessions to roll in...</p>
        </div>
      )}
    </div>
  );
}
