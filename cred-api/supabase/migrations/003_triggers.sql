-- ============================================================
-- Migration 003: Triggers and Database Functions
-- ============================================================

-- -------------------------
-- 1. Capture Google OAuth tokens on sign-in / sign-up
-- -------------------------
create or replace function public.handle_google_auth()
returns trigger as $$
begin
  -- Only process Google provider sign-ins
  if new.raw_app_meta_data->>'provider' = 'google' then
    insert into public.user_google_tokens (
      user_id,
      access_token,
      refresh_token,
      token_expires_at,
      updated_at
    )
    values (
      new.id,
      new.raw_user_meta_data->>'provider_token',
      new.raw_user_meta_data->>'provider_refresh_token',
      now() + interval '1 hour',
      now()
    )
    on conflict (user_id) do update set
      access_token        = excluded.access_token,
      -- Preserve the old refresh token if the new sign-in does not return one
      -- (Google only returns a refresh token on the first authorization)
      refresh_token       = coalesce(
                              nullif(excluded.refresh_token, ''),
                              user_google_tokens.refresh_token
                            ),
      token_expires_at    = excluded.token_expires_at,
      updated_at          = now();
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_or_updated
  after insert or update on auth.users
  for each row execute function public.handle_google_auth();

-- -------------------------
-- 2. Auto-create auto_reply_config row when a restaurant is inserted
-- -------------------------
create or replace function public.create_auto_reply_config()
returns trigger as $$
begin
  insert into public.auto_reply_config (restaurant_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_restaurant_created
  after insert on public.restaurants
  for each row execute function public.create_auto_reply_config();

-- -------------------------
-- 3. Keep updated_at columns current
-- -------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

create trigger set_auto_reply_updated_at
  before update on public.auto_reply_config
  for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -------------------------
-- 4. Subscription usage view
--    Returns reviews_used for the current billing period per user.
-- -------------------------
create or replace view public.subscription_usage as
select
  s.user_id,
  s.reviews_limit,
  s.current_period_start,
  count(r.id) filter (
    where r.posted_at >= coalesce(s.current_period_start, '-infinity'::timestamptz)
  ) as reviews_used
from public.subscriptions s
left join public.restaurants rest on rest.user_id = s.user_id
left join public.reviews r on r.restaurant_id = rest.id
group by s.user_id, s.reviews_limit, s.current_period_start;

-- -------------------------
-- 5. Helper: check if a user has the admin role
--    Admin role is stored in auth.users.raw_app_meta_data->>'role'
--    Set it manually via Supabase Auth admin API or SQL:
--    update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--    where email = 'your@email.com';
-- -------------------------
create or replace function public.is_admin(uid uuid)
returns boolean as $$
  select coalesce(
    (
      select raw_app_meta_data->>'role' = 'admin'
      from auth.users
      where id = uid
    ),
    false
  );
$$ language sql security definer;

-- -------------------------
-- 6. Clean up expired demo search cache entries
--    Called by a pg_cron job (see migration 004)
-- -------------------------
create or replace function public.cleanup_demo_cache()
returns void as $$
begin
  delete from public.demo_search_cache
  where expires_at < now();
end;
$$ language plpgsql security definer;
