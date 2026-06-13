"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Answer = { id: string; name: string; text: string };
type Group = { questionId: string; prompt: string; index: number; answers: Answer[] };

// Opaque light fills only — these cards sit on bg-dark and use text-dark, so a
// translucent fill would render dark-on-dark and be unreadable.
const CARD_COLORS = [
  "bg-cream border-gold",
  "bg-white border-olive",
  "bg-cream border-blush",
  "bg-white border-sage",
];

type Props = { gameId: string; title: string };

export function FinishSentenceDisplay({ gameId, title }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);

  const loadAll = useCallback(async () => {
    const supabase = createClient();

    // Only open-ended questions are reviewed on the big screen.
    const { data: questions } = await supabase
      .from("questions")
      .select("id, prompt, index, question_type")
      .eq("game_instance_id", gameId)
      .eq("question_type", "open")
      .order("index", { ascending: true });

    if (!questions || questions.length === 0) {
      setGroups([]);
      return;
    }

    const { data: answers } = await supabase
      .from("answers")
      .select("id, raw_answer, question_id, answered_at, guests(display_name)")
      .eq("game_instance_id", gameId)
      .order("answered_at", { ascending: true });

    const byQuestion = new Map<string, Answer[]>();
    for (const a of answers ?? []) {
      const list = byQuestion.get(a.question_id) ?? [];
      list.push({
        id: a.id,
        name: (a.guests as unknown as { display_name: string } | null)?.display_name ?? "Guest",
        text: a.raw_answer,
      });
      byQuestion.set(a.question_id, list);
    }

    setGroups(
      questions.map((q) => ({
        questionId: q.id,
        prompt: q.prompt,
        index: q.index,
        answers: byQuestion.get(q.id) ?? [],
      }))
    );
  }, [gameId]);

  useEffect(() => {
    loadAll();
    const supabase = createClient();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "game_event" }, (payload) => {
        // Re-fetch on any new submission so responses land under the right question.
        if (payload.payload.type === "SUBMISSION_LIVE") loadAll();
      })
      .subscribe();

    const poll = setInterval(loadAll, 5000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId, loadAll]);

  const totalAnswers = groups.reduce((sum, g) => sum + g.answers.length, 0);

  return (
    <div className="min-h-screen bg-dark p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-2">{title}</h1>
      <p className="text-center text-white/50 text-sm mb-8">{totalAnswers} responses</p>

      <div className="max-w-5xl mx-auto space-y-10">
        {groups.map((g) => (
          <section key={g.questionId}>
            <h2 className="text-xl md:text-2xl font-bold text-gold mb-4 text-balance">
              {g.prompt}
            </h2>
            {g.answers.length === 0 ? (
              <p className="text-white/40 text-sm italic">Waiting for responses…</p>
            ) : (
              <div className="columns-1 md:columns-2 gap-4 space-y-4">
                {g.answers.map((a, i) => (
                  <div
                    key={a.id}
                    className={cn(
                      "break-inside-avoid rounded-2xl border-2 p-4 animate-slide-up",
                      CARD_COLORS[i % CARD_COLORS.length]
                    )}
                  >
                    <p className="text-dark text-sm leading-relaxed font-medium">&ldquo;{a.text}&rdquo;</p>
                    <p className="text-dark/50 text-xs mt-2 font-semibold">— {a.name}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-6xl">✍️</span>
          <p className="text-white/50 text-center">No open-ended questions to reveal.</p>
        </div>
      )}
    </div>
  );
}
