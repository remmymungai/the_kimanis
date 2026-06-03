-- Track when each question was opened so server-side scoring can calculate time_to_answer
ALTER TABLE questions ADD COLUMN IF NOT EXISTS opened_at timestamptz;
