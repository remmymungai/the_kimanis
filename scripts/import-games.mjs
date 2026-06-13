#!/usr/bin/env node
/**
 * import-games.mjs — Seed party games from the "Gaming Sheet Import.xlsx" workbook.
 *
 * One worksheet (tab) == one game. The tab name maps to a game type. Correct
 * answers are marked in the sheet with a trailing "*" or "**" (both count as
 * correct). For "Find the guest" each participant's chosen fact is the one
 * marked with "*", and the participant is the correct answer.
 *
 * SAFETY: this script is a DRY RUN by default — it parses, validates, and
 * prints a full preview but writes NOTHING. Pass --commit to write to the DB.
 * On --commit it WIPES ALL existing games for the event first (as requested),
 * then re-seeds. Validation ERRORS block --commit unless you also pass --force.
 *
 *   node scripts/import-games.mjs                # preview only (no DB writes)
 *   node scripts/import-games.mjs --commit       # wipe games + seed
 *   node scripts/import-games.mjs --commit --force  # seed even with errors
 *   node scripts/import-games.mjs --file "import/Some Other.xlsx"
 *
 * After committing, review everything at /admin/review before starting.
 */

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EVENT_SLUG = "kimanis-2026";
const DEFAULT_FILE = "import/Gaming Sheet Import.xlsx";

// Per-game settings. Titles are what guests see. Timings/windows are tuned for
// the party; tweak here if you want a different pace.
const GAME_SETTINGS = {
  find_the_guest: {
    title: "Find the Guest",
    config: () => ({ type: "find_the_guest", window_minutes: 20, max_score: 1000 }),
  },
  finish_the_sentence: {
    title: "Finish the Sentence",
    config: () => ({ type: "finish_the_sentence", time_limit_seconds: 30, max_score: 1000 }),
  },
  who_said_what: {
    title: "Who Said What?",
    config: () => ({ type: "who_said_what", time_limit_seconds: 20, max_score: 1000 }),
  },
  trivia: {
    title: "How Well Do You Know the Couple?",
    config: () => ({ type: "trivia", time_limit_seconds: 20, max_score: 1000, leaderboard_after_each: true }),
  },
};

// ---------------------------------------------------------------------------
// CLI args + tiny console helpers
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const FORCE = args.includes("--force");
const fileArgIdx = args.indexOf("--file");
const FILE = fileArgIdx >= 0 ? args[fileArgIdx + 1] : DEFAULT_FILE;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

// ---------------------------------------------------------------------------
// .env.local loader (so we get SUPABASE_SERVICE_ROLE_KEY without extra deps)
// ---------------------------------------------------------------------------

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal XLSX reader (zero npm deps — shells out to `unzip`, parses the XML).
// Only supports what we need: shared strings, inline strings, numbers.
// ---------------------------------------------------------------------------

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function colLetters(ref) {
  return ref.match(/^([A-Z]+)/)[1];
}

function readWorkbook(xlsxPath) {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`File not found: ${xlsxPath}`);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xlsx-"));
  try {
    execFileSync("unzip", ["-o", "-q", xlsxPath, "-d", tmp]);
  } catch (e) {
    throw new Error(`Failed to unzip ${xlsxPath}: ${e.message}`);
  }
  const read = (rel) => {
    const p = path.join(tmp, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };

  // Shared strings
  const ssXml = read("xl/sharedStrings.xml") ?? "";
  const shared = [];
  for (const si of ssXml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]));
    shared.push(parts.join(""));
  }

  // Sheet name -> file
  const wb = read("xl/workbook.xml") ?? "";
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  const relMap = {};
  for (const rel of rels.match(/<Relationship\b[^>]*\/>/g) ?? []) {
    const id = rel.match(/Id="([^"]+)"/);
    const tgt = rel.match(/Target="([^"]+)"/);
    if (id && tgt && tgt[1].includes("worksheets/sheet")) {
      relMap[id[1]] = tgt[1].replace(/^\/?(xl\/)?/, "");
    }
  }
  const sheets = [];
  for (const m of wb.matchAll(/<sheet[^>]*?name="([^"]*)"[^>]*?r:id="(rId\d+)"/g)) {
    const name = decodeXml(m[1]);
    const rid = m[2];
    if (!relMap[rid]) continue;
    const xml = read("xl/" + relMap[rid]);
    if (!xml) continue;
    sheets.push({ name, rows: parseSheet(xml, shared) });
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  return sheets;

  function parseSheet(xml, shared) {
    // returns Map<rowNumber, { COL: value }>
    const rows = new Map();
    for (const rm of xml.matchAll(/<row[^>]*?r="(\d+)"[^>]*?>([\s\S]*?)<\/row>/g)) {
      const rnum = Number(rm[1]);
      const cells = {};
      for (const cm of rm[2].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = cm[1];
        const attrs = cm[2] || "";
        const body = cm[3] || "";
        const t = attrs.match(/t="([^"]*)"/);
        const typ = t ? t[1] : "n";
        const vMatch = body.match(/<v>([\s\S]*?)<\/v>/);
        let txt = "";
        if (typ === "s" && vMatch) {
          txt = shared[Number(vMatch[1])] ?? "";
        } else if (typ === "inlineStr") {
          txt = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
        } else if (vMatch) {
          txt = decodeXml(vMatch[1]);
        }
        txt = txt.trim();
        if (txt) cells[colLetters(ref)] = txt;
      }
      if (Object.keys(cells).length) rows.set(rnum, cells);
    }
    return rows;
  }
}

// ---------------------------------------------------------------------------
// Text / marker helpers
// ---------------------------------------------------------------------------

// Strip invisible junk Excel/Sheets sometimes leaves behind (word joiner,
// zero-width space, BOM, non-breaking space).
function clean(s) {
  return (s ?? "")
    .replace(/[⁠​‌‍﻿]/g, "")
    .replace(/ /g, " ")
    .trim();
}

// A cell marks the correct answer if, ignoring trailing whitespace, it ends
// with one or more asterisks ("*" or "**" both count).
function isStarred(s) {
  return /\*+\s*$/.test((s ?? "").replace(/\s+$/, ""));
}

// Remove the trailing "*"/"**" marker (and any whitespace around it).
function stripMarker(s) {
  return clean((s ?? "").replace(/\s*\*+\s*$/, ""));
}

function normName(name) {
  return clean(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Fisher–Yates shuffle (returns a new array).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toGameType(sheetName) {
  const n = normName(sheetName);
  if (n.includes("findtheguest")) return "find_the_guest";
  if (n.includes("finishthesentence")) return "finish_the_sentence";
  if (n.includes("whosaidwhat")) return "who_said_what";
  if (n.includes("knowthecouple") || n.includes("howwell")) return "trivia";
  return null;
}

// ---------------------------------------------------------------------------
// Sheet parsers — each returns { questions: [...], participants?: [...], issues: [...] }
// A question: { index, prompt, question_type, options|null, correctName?, correctOptionId?, time_limit_seconds }
// An issue:   { level: 'error'|'warn', msg }
// ---------------------------------------------------------------------------

function parseFindTheGuest(rows) {
  // Single column A. A name row, then that person's facts. Blank rows (missing
  // row numbers) separate people. The chosen fact is the one marked "*".
  const ordered = [...rows.entries()]
    .filter(([, v]) => v.A != null)
    .sort((a, b) => a[0] - b[0]);

  const blocks = [];
  let cur = [];
  let prev = null;
  for (const [r, v] of ordered) {
    if (prev !== null && r - prev > 1 && cur.length) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(v.A);
    prev = r;
  }
  if (cur.length) blocks.push(cur);

  const issues = [];
  const questions = [];
  const participants = [];
  let qi = 0;
  for (const block of blocks) {
    const name = clean(block[0]);
    const facts = block.slice(1);
    if (!name) continue;
    const starred = facts.filter((f) => isStarred(f));
    participants.push(name);
    if (starred.length !== 1) {
      issues.push({
        level: "error",
        msg: `Find the Guest: "${name}" has ${starred.length} starred facts (need exactly 1).`,
      });
      if (starred.length === 0) continue; // nothing to seed
    }
    const fact = stripMarker(starred[0]);
    questions.push({
      index: qi++,
      prompt: fact,
      question_type: "choice",
      options: null, // populated from the live guest list at activation
      correctName: name, // resolved to a seeded guest UUID at commit time
      time_limit_seconds: null,
    });
  }
  return { questions, participants, issues };
}

// Generic header-driven choice sheet (who_said_what, trivia).
// optionCols: array of column letters holding answer options.
function parseChoiceSheet(rows, gameType, optionCols) {
  const issues = [];
  const questions = [];
  let qi = 0;
  const rownums = [...rows.keys()].sort((a, b) => a - b).filter((r) => r > 1); // skip header
  for (const r of rownums) {
    const v = rows.get(r);
    const prompt = clean(v.B);
    if (!prompt) continue; // filler / blank row
    const rawOpts = optionCols.map((col) => v[col]).filter((x) => x != null && clean(x) !== "");
    if (rawOpts.length < 2) {
      issues.push({ level: "error", msg: `${gameType} row ${r}: "${prompt.slice(0, 40)}" has <2 options.` });
      continue;
    }
    const starredCount = rawOpts.filter((o) => isStarred(o)).length;
    const options = rawOpts.map((o, j) => ({
      id: `opt_${qi}_${j}`,
      text: stripMarker(o),
      is_correct: isStarred(o),
    }));
    const correct = options.find((o) => o.is_correct);
    if (starredCount === 0) {
      issues.push({ level: "warn", msg: `${gameType} row ${r}: "${prompt.slice(0, 45)}" has NO correct answer marked — it will be unscored.` });
    } else if (starredCount > 1) {
      issues.push({ level: "error", msg: `${gameType} row ${r}: "${prompt.slice(0, 45)}" has ${starredCount} correct answers marked (need 1).` });
    }
    questions.push({
      index: qi++,
      prompt,
      question_type: "choice",
      options,
      correctOptionId: correct ? correct.id : null,
      time_limit_seconds: null, // set below from the per-row time column by caller
    });
  }
  return { questions, issues };
}

function parseFinishTheSentence(rows) {
  // Columns: A=Select, B=Question Type, C=Question, D-G=Options, H=Time Limit
  const issues = [];
  const questions = [];
  let qi = 0;
  const rownums = [...rows.keys()].sort((a, b) => a - b).filter((r) => r > 1);
  for (const r of rownums) {
    const v = rows.get(r);
    const prompt = clean(v.C);
    if (!prompt) continue; // filler row (e.g. A="0")
    const typeRaw = clean(v.B).toLowerCase();
    const isOpen = typeRaw.includes("open");
    const time = v.H ? Math.round(parseFloat(v.H)) : null;
    if (isOpen) {
      questions.push({
        index: qi++,
        prompt,
        question_type: "open",
        options: null,
        correctOptionId: null,
        time_limit_seconds: Number.isFinite(time) ? time : null,
      });
      continue;
    }
    const rawOpts = ["D", "E", "F", "G"].map((col) => v[col]).filter((x) => x != null && clean(x) !== "");
    if (rawOpts.length < 2) {
      issues.push({ level: "error", msg: `Finish the Sentence row ${r}: "${prompt.slice(0, 40)}" is multiple-choice but has <2 options.` });
      continue;
    }
    const starredCount = rawOpts.filter((o) => isStarred(o)).length;
    const options = rawOpts.map((o, j) => ({ id: `opt_${qi}_${j}`, text: stripMarker(o), is_correct: isStarred(o) }));
    const correct = options.find((o) => o.is_correct);
    if (starredCount === 0) {
      issues.push({ level: "warn", msg: `Finish the Sentence row ${r}: "${prompt.slice(0, 45)}" has NO correct answer marked — it will be unscored.` });
    } else if (starredCount > 1) {
      issues.push({ level: "error", msg: `Finish the Sentence row ${r}: "${prompt.slice(0, 45)}" has ${starredCount} correct answers marked (need 1).` });
    }
    questions.push({
      index: qi++,
      prompt,
      question_type: "choice",
      options,
      correctOptionId: correct ? correct.id : null,
      time_limit_seconds: Number.isFinite(time) ? time : null,
    });
  }
  return { questions, issues };
}

// ---------------------------------------------------------------------------
// Build the seed plan from the workbook
// ---------------------------------------------------------------------------

function buildPlan(sheets) {
  const games = [];
  const skipped = [];
  for (const sheet of sheets) {
    const gameType = toGameType(sheet.name);
    if (!gameType) {
      skipped.push(sheet.name);
      continue;
    }
    let parsed;
    if (gameType === "find_the_guest") {
      parsed = parseFindTheGuest(sheet.rows);
    } else if (gameType === "finish_the_sentence") {
      parsed = parseFinishTheSentence(sheet.rows);
    } else if (gameType === "who_said_what") {
      parsed = parseChoiceSheet(sheet.rows, gameType, ["C", "D"]);
      applyRowTime(parsed.questions, sheet.rows, "E");
    } else if (gameType === "trivia") {
      parsed = parseChoiceSheet(sheet.rows, gameType, ["C", "D", "E", "F"]);
      applyRowTime(parsed.questions, sheet.rows, "G");
    }
    games.push({
      sheetName: sheet.name,
      gameType,
      title: GAME_SETTINGS[gameType].title,
      questions: parsed.questions,
      participants: parsed.participants ?? null,
      issues: parsed.issues,
    });
  }
  return { games, skipped };

  // Choice sheets carry a per-row time limit; map it onto the parsed questions
  // in row order (parseChoiceSheet keeps row order, skipping blanks).
  function applyRowTime(questions, rows, timeCol) {
    const rownums = [...rows.keys()].sort((a, b) => a - b).filter((r) => r > 1);
    const realRows = rownums.filter((r) => clean(rows.get(r).B));
    questions.forEach((q, i) => {
      const r = realRows[i];
      const raw = r != null ? rows.get(r)[timeCol] : null;
      const t = raw ? Math.round(parseFloat(raw)) : null;
      q.time_limit_seconds = Number.isFinite(t) ? t : null;
    });
  }
}

// ---------------------------------------------------------------------------
// Preview printer
// ---------------------------------------------------------------------------

function printPreview(plan) {
  console.log(c.bold("\n══════════════════════════════════════════════════════════"));
  console.log(c.bold("  SEED PREVIEW  ") + c.dim(`(source: ${FILE})`));
  console.log(c.bold("══════════════════════════════════════════════════════════"));

  if (plan.skipped.length) {
    console.log(c.dim(`\nSkipped tabs (not a known game): ${plan.skipped.join(", ")}`));
  }

  let totalErrors = 0;
  let totalWarns = 0;

  for (const g of plan.games) {
    console.log("\n" + c.cyan(c.bold(`▶ ${g.title}`)) + c.dim(`  [${g.gameType}]  tab="${g.sheetName}"`));
    console.log(c.dim(`  ${g.questions.length} question(s)`) + (g.participants ? c.dim(`, ${g.participants.length} participants`) : ""));

    g.questions.forEach((q) => {
      if (g.gameType === "find_the_guest") {
        console.log(`  ${String(q.index + 1).padStart(2)}. ${q.prompt}`);
        console.log(`      ${c.green("→ answer: " + q.correctName)}`);
      } else if (q.question_type === "open") {
        console.log(`  ${String(q.index + 1).padStart(2)}. ${q.prompt}  ${c.dim("(open-ended, " + (q.time_limit_seconds ?? "—") + "s)")}`);
      } else {
        console.log(`  ${String(q.index + 1).padStart(2)}. ${q.prompt}  ${c.dim("(" + (q.time_limit_seconds ?? "—") + "s)")}`);
        q.options.forEach((o) => {
          const mark = o.is_correct ? c.green(" ✓") : "  ";
          const txt = o.is_correct ? c.green(o.text) : o.text;
          console.log(`     ${mark} ${txt}`);
        });
      }
    });

    for (const iss of g.issues) {
      if (iss.level === "error") {
        totalErrors++;
        console.log("  " + c.red("✖ ERROR: " + iss.msg));
      } else {
        totalWarns++;
        console.log("  " + c.yellow("⚠ WARN:  " + iss.msg));
      }
    }
  }

  console.log(c.bold("\n──────────────────────────────────────────────────────────"));
  const totalQs = plan.games.reduce((n, g) => n + g.questions.length, 0);
  console.log(`  Games: ${plan.games.length}   Questions: ${totalQs}   ` +
    `Errors: ${totalErrors ? c.red(totalErrors) : "0"}   Warnings: ${totalWarns ? c.yellow(totalWarns) : "0"}`);
  console.log(c.bold("──────────────────────────────────────────────────────────"));
  return { totalErrors, totalWarns, totalQs };
}

// ---------------------------------------------------------------------------
// Commit (DB writes)
// ---------------------------------------------------------------------------

async function commit(plan) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local).");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Event
  const { data: event, error: evErr } = await supabase
    .from("events").select("id, name").eq("slug", EVENT_SLUG).single();
  if (evErr || !event) throw new Error(`Event "${EVENT_SLUG}" not found. Apply 003_seed_event.sql first.`);
  console.log(c.dim(`\nEvent: ${event.name} (${event.id})`));

  // WIPE all existing games for this event (cascades to questions/answers/etc.)
  const { data: existing } = await supabase
    .from("game_instances").select("id, title").eq("event_id", event.id);
  if (existing?.length) {
    console.log(c.yellow(`Wiping ${existing.length} existing game(s): ${existing.map((g) => g.title).join(", ")}`));
    const { error: delErr } = await supabase.from("game_instances").delete().eq("event_id", event.id);
    if (delErr) throw new Error(`Failed to wipe games: ${delErr.message}`);
  } else {
    console.log(c.dim("No existing games to wipe."));
  }

  // Seed guests for Find the Guest participants (reclaim by name, else create).
  // The activate-game function matches each fact's correct answer to a guest by
  // UUID, so the named participants must exist as guests with stable ids.
  const nameToGuestId = new Map();
  const ftg = plan.games.find((g) => g.gameType === "find_the_guest");
  if (ftg && ftg.participants?.length) {
    console.log(c.dim(`\nSeeding ${ftg.participants.length} Find-the-Guest participants as guests…`));
    for (const name of ftg.participants) {
      const { data: found } = await supabase
        .from("guests").select("id").eq("event_id", event.id).ilike("display_name", name).maybeSingle();
      if (found) {
        nameToGuestId.set(name, found.id);
        continue;
      }
      const { data: created, error: insErr } = await supabase
        .from("guests").insert({ event_id: event.id, display_name: name }).select("id").single();
      if (insErr || !created) throw new Error(`Failed to seed guest "${name}": ${insErr?.message}`);
      nameToGuestId.set(name, created.id);
    }
  }

  // Participant pool for Find-the-Guest answer options (id + name).
  const participantPool = (ftg?.participants ?? [])
    .map((name) => ({ id: nameToGuestId.get(name), name }))
    .filter((p) => p.id);

  // Insert games + questions
  let order = 0;
  for (const g of plan.games) {
    const config = { instructions: g.title, ...GAME_SETTINGS[g.gameType].config(g.questions.length) };
    const { data: game, error: gErr } = await supabase
      .from("game_instances")
      .insert({
        event_id: event.id,
        game_type: g.gameType,
        title: g.title,
        config,
        status: "pending",
        display_order: order++,
      })
      .select("id").single();
    if (gErr || !game) throw new Error(`Failed to insert game "${g.title}": ${gErr?.message}`);

    const rows = g.questions.map((q) => {
      let correct_option_id = null;
      let options = q.options; // null for open; array for choice sheets

      if (g.gameType === "find_the_guest") {
        correct_option_id = nameToGuestId.get(q.correctName) ?? null;
        if (!correct_option_id) throw new Error(`No seeded guest for "${q.correctName}".`);
        // Build the answer options now: the correct guest + 3 random other
        // participants, shuffled. Option ids are guest UUIDs so server scoring
        // (raw_answer === correct_option_id) matches. (The app's activate route
        // does NOT populate these, so we must do it at seed time.)
        const decoys = shuffle(participantPool.filter((p) => p.id !== correct_option_id)).slice(0, 3);
        options = shuffle([{ id: correct_option_id, name: q.correctName }, ...decoys]).map((p) => ({
          id: p.id,
          text: p.name,
          is_correct: p.id === correct_option_id,
        }));
      } else if (q.question_type === "choice") {
        correct_option_id = q.correctOptionId;
      }

      return {
        game_instance_id: game.id,
        index: q.index,
        prompt: q.prompt,
        question_type: q.question_type,
        options,
        correct_option_id,
        time_limit_seconds: q.time_limit_seconds ?? null,
      };
    });

    if (rows.length) {
      const { error: qErr } = await supabase.from("questions").insert(rows);
      if (qErr) throw new Error(`Failed to insert questions for "${g.title}": ${qErr.message}`);
    }
    console.log(c.green(`✔ Seeded "${g.title}" — ${rows.length} question(s).`));
  }

  console.log(c.green(c.bold("\n✅ Done. Review everything at /admin/review before starting.")));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();
  const sheets = readWorkbook(path.resolve(process.cwd(), FILE));
  const plan = buildPlan(sheets);
  const { totalErrors } = printPreview(plan);

  if (!COMMIT) {
    console.log(c.dim("\nDry run — nothing was written. Re-run with --commit to seed the database."));
    console.log(c.dim("(--commit WIPES all existing games for the event first.)"));
    return;
  }

  if (totalErrors > 0 && !FORCE) {
    console.log(c.red(`\nRefusing to commit: ${totalErrors} error(s) above. Fix the sheet, or pass --force to seed anyway.`));
    process.exitCode = 1;
    return;
  }

  console.log(c.yellow("\n--commit set: writing to the database…"));
  await commit(plan);
}

main().catch((err) => {
  console.error(c.red("\nImport failed: " + err.message));
  process.exitCode = 1;
});
