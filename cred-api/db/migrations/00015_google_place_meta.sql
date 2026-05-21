ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_rating       NUMERIC(3, 1),
  ADD COLUMN IF NOT EXISTS google_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS google_photo_url    TEXT,
  ADD COLUMN IF NOT EXISTS google_description  TEXT;
