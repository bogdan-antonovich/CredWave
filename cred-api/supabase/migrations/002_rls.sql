-- ============================================================
-- Migration 002: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.restaurants enable row level security;
alter table public.auto_reply_config enable row level security;
alter table public.reviews enable row level security;
alter table public.review_blocks enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.demo_search_cache enable row level security;

-- -------------------------
-- Restaurants
-- -------------------------
create policy "Users can read own restaurants"
  on public.restaurants for select
  using (auth.uid() = user_id);

create policy "Users can insert own restaurants"
  on public.restaurants for insert
  with check (auth.uid() = user_id);

create policy "Users can update own restaurants"
  on public.restaurants for update
  using (auth.uid() = user_id);

create policy "Users can delete own restaurants"
  on public.restaurants for delete
  using (auth.uid() = user_id);

-- -------------------------
-- Auto-reply config
-- -------------------------
create policy "Users can manage own auto-reply config"
  on public.auto_reply_config for all
  using (
    restaurant_id in (
      select id from public.restaurants where user_id = auth.uid()
    )
  );

-- -------------------------
-- Reviews
-- -------------------------
create policy "Users can read own reviews"
  on public.reviews for select
  using (
    restaurant_id in (
      select id from public.restaurants where user_id = auth.uid()
    )
  );

create policy "Users can update own reviews"
  on public.reviews for update
  using (
    restaurant_id in (
      select id from public.restaurants where user_id = auth.uid()
    )
  );

-- Service role handles inserts via Edge Functions (sync cron)
-- No public insert policy on reviews

-- -------------------------
-- Review blocks (demo — public read, admin write only)
-- -------------------------
create policy "Anyone can read review blocks"
  on public.review_blocks for select
  using (true);

-- Demo search cache — public read (cached Google Places results)
create policy "Anyone can read demo search cache"
  on public.demo_search_cache for select
  using (true);

-- -------------------------
-- Subscriptions
-- -------------------------
create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- -------------------------
-- Invoices
-- -------------------------
create policy "Users can read own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

-- -------------------------
-- Contact submissions
-- -------------------------
create policy "Anyone can submit contact form"
  on public.contact_submissions for insert
  with check (true);
-- No read policy — admin reads via service role only
