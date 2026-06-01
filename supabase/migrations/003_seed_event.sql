-- ============================================================
-- Seed: The Kimanis Engagement Party Event
-- Run this once after applying migrations.
-- ============================================================

insert into events (name, slug, is_active)
values ('Remmy & Mbete''s Engagement Party', 'kimanis-2026', true)
on conflict (slug) do nothing;
