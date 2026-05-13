CREATE TABLE d_restaurants (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ON d_restaurants(slug);

CREATE TABLE d_reviews (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES d_restaurants(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  review_text TEXT NOT NULL,
  rating INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ON d_reviews(restaurant_id);

CREATE TABLE d_responses (
  id SERIAL PRIMARY KEY,
  review_id INTEGER REFERENCES d_reviews(id) ON DELETE CASCADE,
  tone TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ON d_responses(review_id);

CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    picture_url TEXT,
    paddle_customer_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ON users(paddle_customer_id);

CREATE TABLE blacklisted_tokens(
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX ON blacklisted_tokens(token);

CREATE TABLE auth_tokens(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL
);
CREATE UNIQUE INDEX ON auth_tokens(user_id);
CREATE UNIQUE INDEX ON auth_tokens(refresh_token);

CREATE TABLE gl_access_tokens(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX ON gl_access_tokens(user_id);

CREATE TABLE gl_refresh_tokens(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL
);
CREATE UNIQUE INDEX ON gl_refresh_tokens(user_id);

CREATE TABLE subscriptions(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    period TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    paddle_subscription_id TEXT NOT NULL,
    reviews_limit INTEGER NOT NULL
);
CREATE UNIQUE INDEX ON subscriptions(paddle_subscription_id);
-- 11:39:03.476
CREATE TABLE payment_methods(
    id SERIAL PRIMARY KEY,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    expiry TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ON payment_methods(user_id, brand, last4, expiry);

CREATE TABLE restaurants(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    google_account_id TEXT,
    google_location_id TEXT NOT NULL,
    last_synced_at TIMESTAMP,
    slug TEXT,
    name TEXT,
    address TEXT,
    owner_name TEXT,
    additional_info TEXT,
    auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_reply_default_tone TEXT DEFAULT '',
    auto_reply_custom_instructions TEXT DEFAULT '',
    updated_at TIMESTAMP
);
CREATE UNIQUE INDEX ON restaurants(user_id);

CREATE TABLE reviews(
    id SERIAL PRIMARY KEY,
    google_review_id TEXT NOT NULL,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL,
    reviewer_avatar_url TEXT NOT NULL,
    review_text TEXT NOT NULL,
    rating INTEGER NOT NULL,
    posted_at TIMESTAMP NOT NULL,
    replied BOOLEAN NOT NULL,
    reply_text TEXT,
    replied_at TIMESTAMP
);
CREATE UNIQUE INDEX ON reviews(google_review_id);

CREATE TABLE responses(
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
    response_json JSONB NOT NULL,
    responses_generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ON responses(review_id);

CREATE TABLE invoices(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    paddle_invoice_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    download_url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contacts(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL
);

CREATE TABLE auto_demo_reviews(
    place_id TEXT PRIMARY KEY,
    reviews JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
