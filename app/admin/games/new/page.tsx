"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GAME_TYPE_LABELS, type GameType } from "@/types/game-config";
import { cn } from "@/lib/utils";

type QuestionDraft = {
  prompt: string;
  question_type: "choice" | "open" | "numeric";
  options: { text: string; is_correct: boolean }[];
  correct_value: string;
  time_limit_seconds: string;
};

const GAME_DEFAULTS: Record<GameType, object> = {
  who_said_what:       { type: "who_said_what", time_limit_seconds: 15, max_score: 1000, instructions: "Guess who said it!" },
  trivia:              { type: "trivia", time_limit_seconds: 20, max_score: 1000, leaderboard_after_each: true, instructions: "How well do you know the couple?" },
  find_the_guest:      { type: "find_the_guest", window_minutes: 15, instructions: "Find the guest who matches each description!" },
  song_request:        { type: "song_request", window_minutes: 10, prompt: "What song do you want at the wedding and why?", instructions: "Request a song!" },
  marriage_advice:     { type: "marriage_advice", window_minutes: 10, prompt: "Give the couple marriage advice — make it fun!", instructions: "Share your wisdom!" },
  finish_the_sentence: { type: "finish_the_sentence", time_limit_seconds: 20, max_score: 1000, instructions: "Finish the sentence!" },
  price_is_right:      { type: "price_is_right", time_limit_seconds: 30, currency: "KES", instructions: "Guess the price in KES!" },
  confessions_wall:    { type: "confessions_wall", window_minutes: 10, moderation: "auto", instructions: "Share anonymously!" },
};

const OPEN_ENDED_GAMES: GameType[] = ["song_request", "marriage_advice", "confessions_wall"];
const TIMED_WINDOW_GAMES: GameType[] = ["find_the_guest", "song_request", "marriage_advice", "confessions_wall"];

export default function NewGamePage() {
  const router = useRouter();
  const [gameType, setGameType] = useState<GameType>("who_said_what");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isOpenEndedGame = OPEN_ENDED_GAMES.includes(gameType);
  const isTimedWindow = TIMED_WINDOW_GAMES.includes(gameType);

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        prompt: "",
        question_type: gameType === "price_is_right" ? "numeric" : gameType === "who_said_what" ? "choice" : "choice",
        options: gameType === "who_said_what"
          ? [{ text: "Remmy", is_correct: false }, { text: "Mbete", is_correct: false }]
          : [{ text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }],
        correct_value: "",
        time_limit_seconds: "",
      },
    ]);
  }

  function updateQuestion(index: number, field: keyof QuestionDraft, value: unknown) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function toggleCorrect(qIdx: number, optIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, j) => ({ ...o, is_correct: j === optIdx })),
        };
      })
    );
  }

  async function handleSave() {
    if (!title.trim()) { setError("Please enter a game title."); return; }
    if (!isOpenEndedGame && !isTimedWindow && questions.length === 0) {
      setError("Please add at least one question.");
      return;
    }

    setSaving(true);
    setError("");

    const supabase = createClient();

    // Look up event
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("slug", "kimanis-2026")
      .single();

    if (!event) { setError("Event not found."); setSaving(false); return; }

    const config = GAME_DEFAULTS[gameType];

    // Create game instance
    const { data: game, error: gErr } = await supabase
      .from("game_instances")
      .insert({
        event_id: event.id,
        game_type: gameType,
        title: title.trim(),
        config,
        display_order: 99,
      })
      .select()
      .single();

    if (gErr || !game) { setError("Failed to create game."); setSaving(false); return; }

    // Insert questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) continue;

      const optionsWithId = q.options.map((o, j) => ({
        id: `opt_${i}_${j}`,
        text: o.text,
        is_correct: o.is_correct,
      }));

      const correctId =
        q.question_type === "numeric"
          ? q.correct_value
          : optionsWithId.find((o) => o.is_correct)?.id ?? null;

      await supabase.from("questions").insert({
        game_instance_id: game.id,
        index: i,
        prompt: q.prompt,
        question_type: q.question_type,
        options: q.question_type !== "numeric" && q.question_type !== "open" ? optionsWithId : null,
        correct_option_id: correctId,
        time_limit_seconds: q.time_limit_seconds ? parseInt(q.time_limit_seconds, 10) : null,
      });
    }

    router.replace(`/admin/games/${game.id}`);
  }

  return (
    <main className="min-h-dvh bg-dark text-white">
      <header className="flex items-center gap-4 px-5 py-4 border-b border-white/10">
        <button onClick={() => router.back()} className="text-white/60 text-sm">← Back</button>
        <h1 className="text-xl font-bold flex-1">New Game</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-gold text-dark rounded-xl font-bold text-sm disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save Game"}
        </button>
      </header>

      <div className="p-5 space-y-6 max-w-xl mx-auto">
        {error && <p className="text-blush text-sm font-medium">{error}</p>}

        {/* Game type */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">
            Game Type
          </label>
          <select
            value={gameType}
            onChange={(e) => { setGameType(e.target.value as GameType); setQuestions([]); }}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white
                       focus:outline-none focus:border-gold"
          >
            {(Object.keys(GAME_TYPE_LABELS) as GameType[]).map((t) => (
              <option key={t} value={t} className="bg-dark">
                {GAME_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">
            Title (shown to guests)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${GAME_TYPE_LABELS[gameType]}`}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white
                       placeholder:text-white/30 focus:outline-none focus:border-gold"
          />
        </div>

        {/* Questions */}
        {!isOpenEndedGame && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Questions ({questions.length})
              </label>
              <button
                onClick={addQuestion}
                className="text-gold text-sm font-semibold"
              >
                + Add Question
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qi) => (
                <div key={qi} className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/50">Question {qi + 1}</span>
                    <button
                      onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                      className="text-blush text-xs"
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    type="text"
                    value={q.prompt}
                    onChange={(e) => updateQuestion(qi, "prompt", e.target.value)}
                    placeholder="Question prompt..."
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white
                               placeholder:text-white/30 focus:outline-none focus:border-gold text-sm"
                  />

                  {/* For finish_the_sentence: choose question type */}
                  {gameType === "finish_the_sentence" && (
                    <div className="flex gap-2">
                      {(["choice", "open"] as const).map((qt) => (
                        <button
                          key={qt}
                          onClick={() => updateQuestion(qi, "question_type", qt)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-semibold border",
                            q.question_type === qt
                              ? "bg-gold border-gold text-dark"
                              : "border-white/20 text-white/60"
                          )}
                        >
                          {qt === "choice" ? "Scored (multiple choice)" : "Open (unscored)"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Choice options */}
                  {q.question_type === "choice" && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCorrect(qi, oi)}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors",
                              opt.is_correct ? "bg-gold border-gold" : "border-white/30"
                            )}
                          />
                          <input
                            type="text"
                            value={gameType === "who_said_what" ? opt.text : opt.text}
                            onChange={(e) =>
                              gameType !== "who_said_what"
                                ? updateQuestion(
                                    qi,
                                    "options",
                                    q.options.map((o, j) => j === oi ? { ...o, text: e.target.value } : o)
                                  )
                                : undefined
                            }
                            readOnly={gameType === "who_said_what"}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white
                                       placeholder:text-white/30 focus:outline-none focus:border-gold text-sm
                                       read-only:opacity-60"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Numeric correct answer */}
                  {q.question_type === "numeric" && (
                    <div>
                      <label className="text-xs text-white/50 block mb-1">Correct answer (KES)</label>
                      <input
                        type="number"
                        value={q.correct_value}
                        onChange={(e) => updateQuestion(qi, "correct_value", e.target.value)}
                        placeholder="e.g. 3500"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white
                                   focus:outline-none focus:border-gold text-sm"
                      />
                    </div>
                  )}

                  {/* Custom time limit */}
                  <div>
                    <label className="text-xs text-white/50 block mb-1">
                      Time limit (seconds, leave blank for game default)
                    </label>
                    <input
                      type="number"
                      value={q.time_limit_seconds}
                      onChange={(e) => updateQuestion(qi, "time_limit_seconds", e.target.value)}
                      placeholder="e.g. 20"
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white
                                 focus:outline-none focus:border-gold text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isOpenEndedGame && (
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-sm">
              {gameType === "confessions_wall"
                ? "Confessions Wall has no pre-set questions — guests submit freely."
                : "This game has a single open-ended question. You can customise the prompt in the game config."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
