import type { GameType, GameConfig } from "@/types/game-config";

/** Games that run on a single whole-game timer (or open submission window),
 *  rather than the admin advancing question-by-question. */
export const WINDOWED_GAMES: GameType[] = [
  "find_the_guest",
  "song_request",
  "marriage_advice",
  "confessions_wall",
];

/** Games where the admin reveals and closes each question in turn. */
export const PER_QUESTION_GAMES: GameType[] = [
  "who_said_what",
  "trivia",
  "finish_the_sentence",
  "price_is_right",
];

/** Open-ended games whose submissions are reviewed on a projector display
 *  (no per-question scoring). Confessions has its own wall. */
export const OPEN_REVIEW_GAMES: GameType[] = ["song_request", "marriage_advice"];

export function isWindowed(t: GameType): boolean {
  return WINDOWED_GAMES.includes(t);
}

export function isScoredWindowed(t: GameType): boolean {
  return t === "find_the_guest";
}

/** Fixed channel name for session-wide (event-wide) broadcasts. */
export const SESSION_CHANNEL = "session:lobby";

/** Compute when a windowed game closes from its activation time + window. */
export function windowCloseAt(
  activatedAt: string | null,
  windowMinutes: number | undefined
): Date | null {
  if (!activatedAt || !windowMinutes) return null;
  return new Date(new Date(activatedAt).getTime() + windowMinutes * 60 * 1000);
}

/** Read window_minutes off a game config regardless of variant. */
export function configWindowMinutes(config: GameConfig | undefined): number | undefined {
  if (!config) return undefined;
  return (config as { window_minutes?: number }).window_minutes;
}
