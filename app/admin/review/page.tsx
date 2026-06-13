"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GAME_TYPE_LABELS } from "@/types/game-config";
import { cn } from "@/lib/utils";
import type { GameInstance, Question, Guest } from "@/types";

type GameWithQuestions = GameInstance & { questions: Question[] };

export default function ReviewPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameWithQuestions[]>([]);
  const [guestsById, setGuestsById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const [{ data: gameRows }, { data: questionRows }, { data: guestRows }] = await Promise.all([
        supabase.from("game_instances").select("*").order("display_order", { ascending: true }),
        supabase.from("questions").select("*").order("index", { ascending: true }),
        supabase.from("guests").select("id, display_name"),
      ]);

      const guestMap: Record<string, string> = {};
      for (const g of (guestRows as Pick<Guest, "id" | "display_name">[]) ?? []) {
        guestMap[g.id] = g.display_name;
      }
      setGuestsById(guestMap);

      const byGame: Record<string, Question[]> = {};
      for (const q of (questionRows as Question[]) ?? []) {
        (byGame[q.game_instance_id] ??= []).push(q);
      }
      setGames(
        ((gameRows as GameInstance[]) ?? []).map((g) => ({
          ...g,
          questions: byGame[g.id] ?? [],
        }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh bg-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  const totalQuestions = games.reduce((n, g) => n + g.questions.length, 0);

  return (
    <main className="min-h-dvh bg-dark text-white">
      <header className="flex items-center gap-4 px-5 py-4 border-b border-white/10 sticky top-0 bg-dark z-10">
        <button onClick={() => router.push("/admin/dashboard")} className="text-white/60 text-sm">
          ← Dashboard
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Question Review</h1>
          <p className="text-white/50 text-xs">
            {games.length} games · {totalQuestions} questions · check every correct answer before starting
          </p>
        </div>
      </header>

      <div className="p-5 space-y-8 max-w-2xl mx-auto pb-24">
        {games.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="text-4xl mb-3">🎮</p>
            <p>No games seeded yet.</p>
          </div>
        )}

        {games.map((game) => (
          <section key={game.id}>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold text-gold">{game.title}</h2>
              <span className="text-xs text-white/40">
                {GAME_TYPE_LABELS[game.game_type]} · {game.questions.length} Q
              </span>
            </div>

            <div className="space-y-3">
              {game.questions.map((q) => (
                <QuestionCard key={q.id} q={q} gameType={game.game_type} guestsById={guestsById} />
              ))}
              {game.questions.length === 0 && (
                <p className="text-white/30 text-sm italic">No questions.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function QuestionCard({
  q,
  gameType,
  guestsById,
}: {
  q: Question;
  gameType: string;
  guestsById: Record<string, string>;
}) {
  // Find the Guest: options are filled from the live guest list at activation,
  // so before the game starts we resolve the correct answer (a guest id) to a name.
  const isFindTheGuest = gameType === "find_the_guest";
  const findGuestName = isFindTheGuest && q.correct_option_id ? guestsById[q.correct_option_id] : null;

  const hasMarkedCorrect =
    q.question_type === "open"
      ? true // open questions are intentionally unscored
      : Boolean(q.correct_option_id);

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
      <div className="flex items-start gap-2">
        <span className="text-white/30 text-sm font-mono pt-0.5 shrink-0">{q.index + 1}.</span>
        <p className="font-semibold text-white flex-1">{q.prompt}</p>
        {q.time_limit_seconds != null && (
          <span className="text-[10px] text-white/40 shrink-0 pt-1">{q.time_limit_seconds}s</span>
        )}
      </div>

      {/* Find the Guest — resolved answer */}
      {isFindTheGuest && (
        <div className="mt-3 ml-6">
          {findGuestName ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-sage/20 text-sage px-3 py-1.5 text-sm font-bold">
              ✓ {findGuestName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blush/20 text-blush px-3 py-1.5 text-sm font-bold">
              ⚠ Correct guest not found (id: {q.correct_option_id ?? "none"})
            </span>
          )}
          <p className="text-white/30 text-[11px] mt-1">
            Other options are drawn from the live guest list when the game is activated.
          </p>
        </div>
      )}

      {/* Open-ended */}
      {!isFindTheGuest && q.question_type === "open" && (
        <p className="mt-2 ml-6 text-white/40 text-sm italic">Open-ended — guests type a free answer (unscored).</p>
      )}

      {/* Choice options */}
      {!isFindTheGuest && q.question_type === "choice" && q.options && (
        <div className="mt-3 ml-6 space-y-1.5">
          {q.options.map((o) => {
            const correct = o.id === q.correct_option_id || o.is_correct;
            return (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                  correct ? "bg-sage/20 text-sage font-bold" : "bg-white/5 text-white/70"
                )}
              >
                <span className="w-4 shrink-0">{correct ? "✓" : ""}</span>
                <span>{o.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Numeric (price-is-right style) */}
      {!isFindTheGuest && q.question_type === "numeric" && (
        <div className="mt-3 ml-6">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-sage/20 text-sage px-3 py-1.5 text-sm font-bold">
            ✓ {q.correct_option_id ?? "—"}
          </span>
        </div>
      )}

      {/* Missing-correct warning */}
      {!hasMarkedCorrect && (
        <p className="mt-3 ml-6 text-blush text-xs font-semibold">
          ⚠ No correct answer marked — this question will be unscored.
        </p>
      )}
    </div>
  );
}
