"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GAME_TYPE_LABELS, type GameType } from "@/types/game-config";
import { isWindowed } from "@/lib/games";
import { cn } from "@/lib/utils";

type Opt = { text: string; is_correct: boolean };
type QuestionDraft = {
  prompt: string;
  question_type: "choice" | "open" | "numeric";
  options: Opt[];
  correct_value: string;
};

// Games that need a list of admin-authored questions
const QUESTION_GAMES: GameType[] = [
  "who_said_what",
  "trivia",
  "finish_the_sentence",
  "price_is_right",
  "find_the_guest",
];
// Games that are a single open prompt (auto one open question)
const SINGLE_PROMPT_GAMES: GameType[] = ["song_request", "marriage_advice"];

function defaultQuestion(gameType: GameType): QuestionDraft {
  if (gameType === "price_is_right") {
    return { prompt: "", question_type: "numeric", options: [], correct_value: "" };
  }
  if (gameType === "who_said_what") {
    return {
      prompt: "",
      question_type: "choice",
      options: [
        { text: "Remmy", is_correct: false },
        { text: "Mbete", is_correct: false },
      ],
      correct_value: "",
    };
  }
  // trivia / finish_the_sentence / find_the_guest → start with 2 blank options
  return {
    prompt: "",
    question_type: "choice",
    options: [
      { text: "", is_correct: false },
      { text: "", is_correct: false },
    ],
    correct_value: "",
  };
}

export default function NewGamePage() {
  const router = useRouter();
  const [gameType, setGameType] = useState<GameType>("who_said_what");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [timeLimit, setTimeLimit] = useState("20");
  const [windowMinutes, setWindowMinutes] = useState("10");
  const [prompt, setPrompt] = useState("");
  const [maxScore] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsQuestions = QUESTION_GAMES.includes(gameType);
  const isSinglePrompt = SINGLE_PROMPT_GAMES.includes(gameType);
  const isConfessions = gameType === "confessions_wall";
  const windowed = isWindowed(gameType);
  const lockedOptions = gameType === "who_said_what"; // fixed Remmy/Mbete

  function onGameTypeChange(t: GameType) {
    setGameType(t);
    setQuestions([]);
    setError("");
    if (t === "song_request") setPrompt("What song do you want at the wedding and why?");
    else if (t === "marriage_advice") setPrompt("Give the couple marriage advice — make it fun!");
    else setPrompt("");
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, defaultQuestion(gameType)]);
  }

  function patchQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function setOptionText(qi: number, oi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, text } : o)) } : q
      )
    );
  }

  function markCorrect(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })) } : q
      )
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi && q.options.length < 4
          ? { ...q, options: [...q.options, { text: "", is_correct: false }] }
          : q
      )
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi && q.options.length > 2
          ? { ...q, options: q.options.filter((_, j) => j !== oi) }
          : q
      )
    );
  }

  function validate(): string | null {
    if (!title.trim()) return "Please enter a game title.";
    if (isSinglePrompt && !prompt.trim()) return "Please enter the question prompt.";
    if (needsQuestions) {
      if (questions.length === 0) return "Please add at least one question.";
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt.`;
        if (q.question_type === "numeric") {
          if (!q.correct_value.trim() || isNaN(Number(q.correct_value)))
            return `Question ${i + 1} needs a numeric correct answer.`;
        } else if (q.question_type === "choice") {
          const filled = q.options.filter((o) => o.text.trim());
          if (filled.length < 2) return `Question ${i + 1} needs at least 2 options.`;
          if (!filled.some((o) => o.is_correct))
            return `Question ${i + 1} needs a correct answer marked.`;
        }
      }
    }
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: event } = await supabase
      .from("events").select("id").eq("slug", "kimanis-2026").single();
    if (!event) { setError("Event not found."); setSaving(false); return; }

    // Build config
    const base = { instructions: title.trim() };
    let config: Record<string, unknown>;
    if (gameType === "trivia")
      config = { ...base, type: gameType, time_limit_seconds: Number(timeLimit), max_score: maxScore, leaderboard_after_each: true };
    else if (gameType === "who_said_what" || gameType === "finish_the_sentence")
      config = { ...base, type: gameType, time_limit_seconds: Number(timeLimit), max_score: maxScore };
    else if (gameType === "price_is_right")
      config = { ...base, type: gameType, time_limit_seconds: Number(timeLimit), currency: "KES", max_score: maxScore };
    else if (gameType === "find_the_guest")
      config = { ...base, type: gameType, window_minutes: Number(windowMinutes), max_score: maxScore };
    else if (gameType === "confessions_wall")
      config = { ...base, type: gameType, window_minutes: Number(windowMinutes), moderation: "admin" };
    else
      config = { ...base, type: gameType, window_minutes: Number(windowMinutes), prompt: prompt.trim() };

    const { data: game, error: gErr } = await supabase
      .from("game_instances")
      .insert({ event_id: event.id, game_type: gameType, title: title.trim(), config, display_order: 99 })
      .select()
      .single();
    if (gErr || !game) { setError("Failed to create game."); setSaving(false); return; }

    // Build questions
    const rows: Record<string, unknown>[] = [];
    if (isSinglePrompt) {
      rows.push({
        game_instance_id: game.id, index: 0, prompt: prompt.trim(),
        question_type: "open", options: null, correct_option_id: null,
        time_limit_seconds: null,
      });
    } else if (needsQuestions) {
      questions.forEach((q, i) => {
        if (q.question_type === "numeric") {
          rows.push({
            game_instance_id: game.id, index: i, prompt: q.prompt.trim(),
            question_type: "numeric", options: null,
            correct_option_id: String(Number(q.correct_value)), time_limit_seconds: null,
          });
        } else if (q.question_type === "open") {
          rows.push({
            game_instance_id: game.id, index: i, prompt: q.prompt.trim(),
            question_type: "open", options: null, correct_option_id: null, time_limit_seconds: null,
          });
        } else {
          // choice — keep only non-empty options
          const filled = q.options.filter((o) => o.text.trim());
          const withId = filled.map((o, j) => ({ id: `opt_${i}_${j}`, text: o.text.trim(), is_correct: o.is_correct }));
          const correct = withId.find((o) => o.is_correct)?.id ?? null;
          rows.push({
            game_instance_id: game.id, index: i, prompt: q.prompt.trim(),
            question_type: "choice", options: withId, correct_option_id: correct, time_limit_seconds: null,
          });
        }
      });
    }

    if (rows.length > 0) {
      const { error: qErr } = await supabase.from("questions").insert(rows);
      if (qErr) { setError("Failed to save questions: " + qErr.message); setSaving(false); return; }
    }

    router.replace(`/admin/games/${game.id}`);
  }

  return (
    <main className="min-h-dvh bg-dark text-white">
      <header className="flex items-center gap-4 px-5 py-4 border-b border-white/10">
        <button onClick={() => router.back()} className="text-white/60 text-sm">← Back</button>
        <h1 className="text-xl font-bold flex-1">New Game</h1>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-gold text-dark rounded-xl font-bold text-sm disabled:opacity-40">
          {saving ? "Saving…" : "Save Game"}
        </button>
      </header>

      <div className="p-5 space-y-6 max-w-xl mx-auto">
        {error && <p className="text-blush text-sm font-medium bg-blush/10 rounded-xl px-4 py-3">{error}</p>}

        {/* Game type */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">Game Type</label>
          <select value={gameType} onChange={(e) => onGameTypeChange(e.target.value as GameType)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold">
            {(Object.keys(GAME_TYPE_LABELS) as GameType[]).map((t) => (
              <option key={t} value={t} className="bg-dark">{GAME_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">Title (shown to guests)</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${GAME_TYPE_LABELS[gameType]}`}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold" />
        </div>

        {/* Game-level timing */}
        <div className="grid grid-cols-2 gap-3">
          {!windowed && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">Seconds / question</label>
              <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold" />
            </div>
          )}
          {windowed && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">Window (minutes)</label>
              <input type="number" value={windowMinutes} onChange={(e) => setWindowMinutes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold" />
            </div>
          )}
        </div>

        {/* Single open prompt (song / advice) */}
        {isSinglePrompt && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-white/50 block mb-2">Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold resize-none" />
          </div>
        )}

        {isConfessions && (
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-sm">
              Guests submit confessions anonymously. Each one waits for your ✓ approval in the
              moderation panel before it appears on the wall.
            </p>
          </div>
        )}

        {/* Question editor */}
        {needsQuestions && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-white/50">
                {gameType === "find_the_guest" ? "Clues" : "Questions"} ({questions.length})
              </label>
              <button onClick={addQuestion} className="text-gold text-sm font-semibold">
                + Add {gameType === "find_the_guest" ? "Clue" : "Question"}
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qi) => (
                <div key={qi} className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/50">
                      {gameType === "find_the_guest" ? "Clue" : "Question"} {qi + 1}
                    </span>
                    <button onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                      className="text-blush text-xs">Remove</button>
                  </div>

                  <input type="text" value={q.prompt} onChange={(e) => patchQuestion(qi, { prompt: e.target.value })}
                    placeholder={gameType === "find_the_guest" ? "e.g. Has 4 cats" : "Question prompt…"}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold text-sm" />

                  {gameType === "finish_the_sentence" && (
                    <div className="flex gap-2">
                      {(["choice", "open"] as const).map((qt) => (
                        <button key={qt} onClick={() => patchQuestion(qi, { question_type: qt })}
                          className={cn("px-3 py-1 rounded-lg text-xs font-semibold border",
                            q.question_type === qt ? "bg-gold border-gold text-dark" : "border-white/20 text-white/60")}>
                          {qt === "choice" ? "Scored (choices)" : "Open (unscored)"}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.question_type === "choice" && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <button onClick={() => markCorrect(qi, oi)}
                            title="Mark correct"
                            className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors",
                              opt.is_correct ? "bg-gold border-gold" : "border-white/30")} />
                          <input type="text" value={opt.text}
                            onChange={(e) => !lockedOptions && setOptionText(qi, oi, e.target.value)}
                            readOnly={lockedOptions}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold text-sm read-only:opacity-70" />
                          {!lockedOptions && q.options.length > 2 && (
                            <button onClick={() => removeOption(qi, oi)} className="text-white/40 text-lg leading-none px-1">×</button>
                          )}
                        </div>
                      ))}
                      {!lockedOptions && q.options.length < 4 && (
                        <button onClick={() => addOption(qi)} className="text-gold/80 text-xs font-semibold">+ Add option</button>
                      )}
                      <p className="text-white/30 text-[11px]">Tap the circle to mark the correct answer.</p>
                    </div>
                  )}

                  {q.question_type === "numeric" && (
                    <div>
                      <label className="text-xs text-white/50 block mb-1">Correct answer (KES)</label>
                      <input type="number" value={q.correct_value}
                        onChange={(e) => patchQuestion(qi, { correct_value: e.target.value })}
                        placeholder="e.g. 3500"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold text-sm" />
                    </div>
                  )}

                  {q.question_type === "open" && (
                    <p className="text-white/40 text-xs">Open answer — guests type freely; reviewed on the big screen (no score).</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
