export type LeaderboardEntry = {
  guest_id: string;
  display_name: string;
  cumulative_points: number;
  rank: number;
};

export type QuestionOption = {
  id: string;
  text: string;
};

export type QuestionPayload = {
  id: string;
  index: number;
  prompt: string;
  question_type: "choice" | "open" | "numeric";
  options: QuestionOption[] | null;
  time_limit_seconds: number | null;
  media_url: string | null;
  total_questions: number;
};

export type RealtimeMessage =
  | {
      type: "GAME_STATE_CHANGE";
      game_instance_id: string;
      new_status: string;
      current_question_index: number;
    }
  | {
      type: "QUESTION_REVEAL";
      question: QuestionPayload;
      opens_at: string;
      closes_at: string | null;
    }
  | {
      type: "QUESTION_CLOSED";
      question_id: string;
      correct_option_id: string | null;
      correct_value?: number;
      top_10: LeaderboardEntry[];
      /** Per-guest score for this question: { [guest_id]: { points_awarded, is_correct } } */
      player_points?: Record<string, { points_awarded: number; is_correct: boolean | null }>;
    }
  | {
      type: "GAME_COMPLETED";
      game_instance_id: string;
      final_leaderboard: LeaderboardEntry[];
    }
  | {
      type: "CONFESSION_LIVE";
      id: string;
      content: string;
    }
  | {
      type: "ADMIN_ANNOUNCEMENT";
      message: string;
    }
  | {
      type: "ANSWER_RECEIVED";
      game_instance_id: string;
      question_id: string;
    };
