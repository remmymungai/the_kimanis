-- Record the author of each confession for post-party reference ONLY.
-- Confessions remain anonymous on every wall, broadcast, and moderation screen:
-- no read path selects guest_id. This column lets the hosts look up who said
-- what by querying the database directly after the event.
ALTER TABLE confessions
  ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES guests(id) ON DELETE SET NULL;
