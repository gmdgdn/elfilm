-- Add release date support for "On this day" premiere tracking.

ALTER TABLE movies ADD COLUMN release_date TEXT;
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date);
