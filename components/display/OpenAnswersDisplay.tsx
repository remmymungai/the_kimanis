"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Card = { id: string; name: string; text: string };

const CARD_COLORS = [
  "bg-cream border-gold",
  "bg-white border-olive",
  "bg-blush/10 border-blush",
  "bg-sage/10 border-sage",
];

/** song_request stores JSON; everything else is plain text. */
export function formatContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "song_title" in parsed) {
      return [parsed.song_title, parsed.artist && `— ${parsed.artist}`, parsed.note && `(${parsed.note})`]
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    /* plain text */
  }
  return raw;
}

type Props = { gameId: string; title: string };

export function OpenAnswersDisplay({ gameId, title }: Props) {
  const [cards, setCards] = useState<Card[]>([]);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("answers")
      .select("id, raw_answer, guests(display_name)")
      .eq("game_instance_id", gameId)
      .order("answered_at", { ascending: true });

    if (data) {
      setCards(
        data.map((a) => ({
          id: a.id,
          name: (a.guests as unknown as { display_name: string } | null)?.display_name ?? "Guest",
          text: formatContent(a.raw_answer),
        }))
      );
    }
  }, [gameId]);

  useEffect(() => {
    loadAll();
    const supabase = createClient();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "game_event" }, (payload) => {
        const msg = payload.payload;
        if (msg.type === "SUBMISSION_LIVE") {
          setCards((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, name: msg.guest_name, text: formatContent(msg.content) },
          ]);
        }
      })
      .subscribe();

    const poll = setInterval(loadAll, 6000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId, loadAll]);

  return (
    <div className="min-h-screen bg-dark p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-2">{title}</h1>
      <p className="text-center text-white/50 text-sm mb-8">{cards.length} responses</p>

      <div className="columns-2 md:columns-3 gap-4 space-y-4">
        {cards.map((c, i) => (
          <div
            key={c.id}
            className={cn("break-inside-avoid rounded-2xl border-2 p-4 animate-slide-up", CARD_COLORS[i % CARD_COLORS.length])}
            style={{ animationDelay: `${(i % 5) * 0.05}s` }}
          >
            <p className="text-dark text-sm leading-relaxed font-medium">&ldquo;{c.text}&rdquo;</p>
            <p className="text-dark/50 text-xs mt-2 font-semibold">— {c.name}</p>
          </div>
        ))}
      </div>

      {cards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-6xl">📝</span>
          <p className="text-white/50 text-center">Waiting for responses…</p>
        </div>
      )}
    </div>
  );
}
