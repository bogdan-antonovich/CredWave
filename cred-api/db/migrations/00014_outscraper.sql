ALTER TABLE restaurants RENAME COLUMN google_location_id TO google_place_id;
ALTER TABLE restaurants DROP COLUMN IF EXISTS google_account_id;
ALTER TABLE restaurants ALTER COLUMN google_place_id DROP NOT NULL;

-- Old unique constraint was on google_location_id (now renamed); drop it and replace with per-user uniqueness
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_google_location_id_key;
ALTER TABLE restaurants ADD CONSTRAINT restaurants_user_place_unique UNIQUE (user_id, google_place_id);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS outscraper_pagination_id TEXT;
