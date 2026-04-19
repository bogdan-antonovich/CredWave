-- ============================================================
-- Migration 001: Core Tables
-- ============================================================

-- Google tokens table (not managed by Supabase Auth)
create table public.user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  updated_at timestamptz default now()
);

alter table public.user_google_tokens enable row level security;
-- No public RLS policies — only service role accesses tokens

-- Restaurants
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text,
  google_account_id text,
  google_location_id text,
  name text not null,
  slug text unique not null,
  address text,
  rating numeric(2,1),
  review_count int default 0,
  owner_name text,
  additional_info text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_restaurants_user_id on public.restaurants(user_id);
create unique index idx_restaurants_slug on public.restaurants(slug);

-- Auto-reply config (one per restaurant)
create table public.auto_reply_config (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid unique not null references public.restaurants(id) on delete cascade,
  enabled boolean default false,
  default_tone text default 'professional' check (default_tone in ('empathetic', 'professional', 'casual')),
  custom_instructions text,
  updated_at timestamptz default now()
);

-- Reviews synced from Google Business Profile
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  google_review_id text unique,
  reviewer_name text,
  reviewer_avatar_url text,
  review_text text,
  rating int check (rating between 1 and 5),
  posted_at timestamptz,
  replied boolean default false,
  reply_text text,
  replied_at timestamptz,
  response_empathetic text,
  response_professional text,
  response_casual text,
  responses_generated_at timestamptz,
  synced_at timestamptz default now()
);

create index idx_reviews_restaurant_status on public.reviews(restaurant_id, replied);
create index idx_reviews_restaurant_date on public.reviews(restaurant_id, posted_at desc);

-- Demo / admin review blocks (public read)
create table public.review_blocks (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  reviewer_name text,
  review_text text,
  rating int check (rating between 1 and 5),
  response_a text,
  response_b text,
  response_c text
);

create index idx_review_blocks_restaurant on public.review_blocks(restaurant_name);

-- Subscriptions (one per user)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  paddle_subscription_id text,
  paddle_customer_id text,
  plan_name text,
  price int default 0, -- cents
  period text check (period in ('monthly', 'annual')),
  status text default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  reviews_limit int default 50,
  current_period_start timestamptz,
  next_billing_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paddle_transaction_id text unique,
  amount int default 0, -- cents
  currency text default 'USD',
  status text default 'paid' check (status in ('paid', 'refunded')),
  download_url text,
  created_at timestamptz default now()
);

-- Contact form submissions
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz default now()
);

-- Demo search cache (Google Places results cached for 24h)
create table public.demo_search_cache (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  results jsonb not null,
  cached_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

create unique index idx_demo_search_cache_query on public.demo_search_cache(query);
