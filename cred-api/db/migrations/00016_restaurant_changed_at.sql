ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS restaurant_changed_at TIMESTAMPTZ;
