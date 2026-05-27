-- Remove duplicate subscriptions, keeping the most recently inserted row per user
DELETE FROM subscriptions
WHERE id NOT IN (
  SELECT MAX(id) FROM subscriptions GROUP BY user_id
);

-- Enforce one subscription per user
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
