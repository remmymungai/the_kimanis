import type { GameConfig, GameStatus, GameType } from "./game-config";

export type Event = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

export type Guest = {
  id: string;
  event_id: string;
  display_name: string;
  joined_at: string;
  is_blocked: boolean;
};

export type GameInstance = {
  id: string;
  event_id: string;
  game_type: GameType;
  title: string;
  config: GameConfig;
  status: GameStatus;
  current_question_index: number;
  activated_at: string | null;
  completed_at: string | null;
  display_order: number;
  created_at: string;
};

export type Question = {
  id: string;
  game_instance_id: string;
  index: number;
  prompt: string;
  question_type: "choice" | "open" | "numeric";
  options: { id: string; text: string; is_correct: boolean }[] | null;
  correct_option_id: string | null;
  time_limit_seconds: number | null;
  media_url: string | null;
};

export type Answer = {
  id: string;
  question_id: string;
  guest_id: string;
  game_instance_id: string;
  raw_answer: string;
  is_correct: boolean | null;
  points_awarded: number;
  answered_at: string;
};

export type LeaderboardSnapshot = {
  id: string;
  game_instance_id: string;
  question_index: number;
  guest_id: string;
  display_name: string;
  cumulative_points: number;
  rank: number;
  snapshot_at: string;
};

export type Confession = {
  id: string;
  game_instance_id: string;
  content: string;
  is_approved: boolean;
  submitted_at: string;
};

export type SongRequest = {
  id: string;
  game_instance_id: string;
  guest_id: string;
  song_title: string;
  artist: string | null;
  note: string | null;
  submitted_at: string;
};

export type AdviceEntry = {
  id: string;
  game_instance_id: string;
  guest_id: string;
  content: string;
  submitted_at: string;
};
