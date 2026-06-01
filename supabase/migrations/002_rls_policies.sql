-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Helper function: check if current user is admin
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from admin_profiles where id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- EVENTS — public read, admin write
-- ============================================================
alter table events enable row level security;

create policy "events_select_all"
  on events for select to anon, authenticated using (true);

create policy "events_admin_write"
  on events for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- GUESTS — public insert (join), public read, no delete
-- ============================================================
alter table guests enable row level security;

create policy "guests_select_all"
  on guests for select to anon, authenticated using (true);

create policy "guests_insert_anon"
  on guests for insert to anon, authenticated
  with check (true);

create policy "guests_admin_update"
  on guests for update to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- GAME INSTANCES — public read, admin write
-- ============================================================
alter table game_instances enable row level security;

create policy "game_instances_select_all"
  on game_instances for select to anon, authenticated using (true);

create policy "game_instances_admin_write"
  on game_instances for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- QUESTIONS — public read, admin write
-- ============================================================
alter table questions enable row level security;

create policy "questions_select_all"
  on questions for select to anon, authenticated using (true);

create policy "questions_admin_write"
  on questions for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- ANSWERS — guests insert own, admin reads all
-- ============================================================
alter table answers enable row level security;

create policy "answers_insert_guest"
  on answers for insert to anon, authenticated
  with check (true);

create policy "answers_select_own"
  on answers for select to anon, authenticated
  using (true);

create policy "answers_admin_update"
  on answers for update to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- LEADERBOARD SNAPSHOTS — public read, server write only
-- ============================================================
alter table leaderboard_snapshots enable row level security;

create policy "leaderboard_select_all"
  on leaderboard_snapshots for select to anon, authenticated using (true);

create policy "leaderboard_admin_write"
  on leaderboard_snapshots for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- CONFESSIONS — anon insert, public read (approved only)
-- ============================================================
alter table confessions enable row level security;

create policy "confessions_insert_anon"
  on confessions for insert to anon, authenticated
  with check (true);

create policy "confessions_select_approved"
  on confessions for select to anon, authenticated
  using (is_approved = true);

create policy "confessions_admin_all"
  on confessions for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============================================================
-- SONG REQUESTS — insert + read all
-- ============================================================
alter table song_requests enable row level security;

create policy "song_requests_insert_anon"
  on song_requests for insert to anon, authenticated with check (true);

create policy "song_requests_select_all"
  on song_requests for select to anon, authenticated using (true);

-- ============================================================
-- ADVICE ENTRIES — insert + read all
-- ============================================================
alter table advice_entries enable row level security;

create policy "advice_entries_insert_anon"
  on advice_entries for insert to anon, authenticated with check (true);

create policy "advice_entries_select_all"
  on advice_entries for select to anon, authenticated using (true);

-- ============================================================
-- ADMIN PROFILES — private
-- ============================================================
alter table admin_profiles enable row level security;

create policy "admin_profiles_own"
  on admin_profiles for select to authenticated
  using (id = auth.uid());
