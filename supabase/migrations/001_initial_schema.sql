-- ============================================================
-- The Kimanis Engagement Party Game Hub — Initial Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- EVENTS
-- One row per party event. Production has exactly one.
-- ============================================================
create table events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- GUESTS
-- Identified by display_name, unique per event.
-- guest_id stored in browser localStorage.
-- ============================================================
create table guests (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  display_name text not null,
  joined_at    timestamptz not null default now(),
  is_blocked   boolean not null default false,
  unique(event_id, display_name)
);

-- ============================================================
-- GAME INSTANCES
-- Admin creates these; one per activated game.
-- config JSONB is typed via TypeScript discriminated union.
-- ============================================================
create table game_instances (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references events(id) on delete cascade,
  game_type               text not null,
  title                   text not null,
  config                  jsonb not null default '{}',
  status                  text not null default 'pending'
                            check (status in ('pending','active','question_open','question_closed','completed')),
  current_question_index  integer not null default 0,
  activated_at            timestamptz,
  completed_at            timestamptz,
  display_order           integer not null default 0,
  created_at              timestamptz not null default now()
);

-- ============================================================
-- QUESTIONS
-- Belong to a game instance. Normalized rows.
-- ============================================================
create table questions (
  id                uuid primary key default gen_random_uuid(),
  game_instance_id  uuid not null references game_instances(id) on delete cascade,
  index             integer not null,
  prompt            text not null,
  question_type     text not null check (question_type in ('choice','open','numeric')),
  options           jsonb,   -- [{id, text, is_correct}] or null
  correct_option_id text,    -- option id for choice, numeric string for price_is_right, null for open
  time_limit_seconds integer,
  media_url         text,
  unique(game_instance_id, index)
);

-- ============================================================
-- ANSWERS
-- One per guest per question. Scored server-side.
-- ============================================================
create table answers (
  id                uuid primary key default gen_random_uuid(),
  question_id       uuid not null references questions(id) on delete cascade,
  guest_id          uuid not null references guests(id) on delete cascade,
  game_instance_id  uuid not null references game_instances(id) on delete cascade,
  raw_answer        text not null,
  is_correct        boolean,
  points_awarded    integer not null default 0,
  answered_at       timestamptz not null default now(),
  unique(question_id, guest_id)
);

-- ============================================================
-- LEADERBOARD SNAPSHOTS
-- Materialized after each question closes. Instant reads.
-- ============================================================
create table leaderboard_snapshots (
  id                uuid primary key default gen_random_uuid(),
  game_instance_id  uuid not null references game_instances(id) on delete cascade,
  question_index    integer not null,
  guest_id          uuid not null references guests(id) on delete cascade,
  display_name      text not null,
  cumulative_points integer not null default 0,
  rank              integer not null,
  snapshot_at       timestamptz not null default now(),
  unique(game_instance_id, question_index, guest_id)
);

-- ============================================================
-- CONFESSIONS
-- Fully anonymous. No guest_id.
-- ============================================================
create table confessions (
  id                uuid primary key default gen_random_uuid(),
  game_instance_id  uuid not null references game_instances(id) on delete cascade,
  content           text not null,
  is_approved       boolean not null default true,
  submitted_at      timestamptz not null default now()
);

-- ============================================================
-- SONG REQUESTS
-- ============================================================
create table song_requests (
  id                uuid primary key default gen_random_uuid(),
  game_instance_id  uuid not null references game_instances(id) on delete cascade,
  guest_id          uuid not null references guests(id) on delete cascade,
  song_title        text not null,
  artist            text,
  note              text,
  submitted_at      timestamptz not null default now()
);

-- ============================================================
-- ADVICE ENTRIES
-- ============================================================
create table advice_entries (
  id                uuid primary key default gen_random_uuid(),
  game_instance_id  uuid not null references game_instances(id) on delete cascade,
  guest_id          uuid not null references guests(id) on delete cascade,
  content           text not null,
  submitted_at      timestamptz not null default now()
);

-- ============================================================
-- ADMIN PROFILES
-- Supabase Auth users with admin flag.
-- ============================================================
create table admin_profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  is_admin  boolean not null default false
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_game_instances_event    on game_instances(event_id, display_order);
create index idx_questions_game          on questions(game_instance_id, index);
create index idx_answers_question        on answers(question_id);
create index idx_answers_game_guest      on answers(game_instance_id, guest_id);
create index idx_leaderboard_game_q      on leaderboard_snapshots(game_instance_id, question_index);
create index idx_confessions_game        on confessions(game_instance_id, submitted_at);
create index idx_song_requests_game      on song_requests(game_instance_id);
create index idx_advice_entries_game     on advice_entries(game_instance_id);
