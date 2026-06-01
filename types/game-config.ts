export type GameType =
  | "who_said_what"
  | "find_the_guest"
  | "trivia"
  | "song_request"
  | "marriage_advice"
  | "finish_the_sentence"
  | "price_is_right"
  | "confessions_wall";

export type GameStatus =
  | "pending"
  | "active"
  | "question_open"
  | "question_closed"
  | "completed";

type BaseConfig = {
  instructions: string;
};

export type WhoSaidWhatConfig = BaseConfig & {
  type: "who_said_what";
  time_limit_seconds: number;
  max_score: number;
};

export type FindTheGuestConfig = BaseConfig & {
  type: "find_the_guest";
  window_minutes: number;
};

export type TriviaConfig = BaseConfig & {
  type: "trivia";
  time_limit_seconds: number;
  max_score: number;
  leaderboard_after_each: boolean;
};

export type SongRequestConfig = BaseConfig & {
  type: "song_request";
  window_minutes: number;
  prompt: string;
};

export type MarriageAdviceConfig = BaseConfig & {
  type: "marriage_advice";
  window_minutes: number;
  prompt: string;
};

export type FinishTheSentenceConfig = BaseConfig & {
  type: "finish_the_sentence";
  time_limit_seconds: number;
  max_score: number;
};

export type PriceIsRightConfig = BaseConfig & {
  type: "price_is_right";
  time_limit_seconds: number;
  currency: "KES";
};

export type ConfessionsWallConfig = BaseConfig & {
  type: "confessions_wall";
  window_minutes: number;
  moderation: "auto" | "admin";
};

export type GameConfig =
  | WhoSaidWhatConfig
  | FindTheGuestConfig
  | TriviaConfig
  | SongRequestConfig
  | MarriageAdviceConfig
  | FinishTheSentenceConfig
  | PriceIsRightConfig
  | ConfessionsWallConfig;

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  who_said_what: "Who Said What?",
  find_the_guest: "Find the Guest",
  trivia: "How Well Do You Know the Couple?",
  song_request: "Wedding Song Request",
  marriage_advice: "Marriage Advice",
  finish_the_sentence: "Finish the Sentence",
  price_is_right: "The Price Is Right — Wedding Edition",
  confessions_wall: "Confessions Wall",
};
