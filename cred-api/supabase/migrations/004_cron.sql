-- ============================================================
-- Migration 004: pg_cron Scheduled Jobs
--
-- Prerequisites:
--   1. Enable the pg_cron extension in Supabase Dashboard →
--      Database → Extensions → pg_cron
--   2. Enable the pg_net extension (used for HTTP calls from SQL)
--   3. After enabling, run this migration in the SQL editor
--   4. Set the following app settings (replace placeholders):
--
--      alter database postgres set
--        app.settings.supabase_url = 'https://xxxxx.supabase.co';
--      alter database postgres set
--        app.settings.service_role_key = 'eyJ...';
-- ============================================================

-- -------------------------
-- 1. Review sync — every 5 minutes
--    Calls the review-sync Edge Function for every restaurant
--    belonging to an active subscription.
-- -------------------------
create or replace function public.trigger_review_sync()
returns void as $$
declare
  r                  record;
  edge_function_url  text;
begin
  edge_function_url :=
    current_setting('app.settings.supabase_url', true)
    || '/functions/v1/review-sync';

  for r in
    select
      rest.id   as restaurant_id,
      rest.user_id
    from public.restaurants rest
    join public.subscriptions sub on sub.user_id = rest.user_id
    where sub.status in ('active', 'trialing')
  loop
    perform net.http_post(
      url     := edge_function_url,
      headers := jsonb_build_object(
        'Authorization',  'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',   'application/json'
      ),
      body    := jsonb_build_object(
        'restaurant_id', r.restaurant_id,
        'user_id',       r.user_id
      )
    );
  end loop;
end;
$$ language plpgsql security definer;

select cron.schedule(
  'review-sync',
  '*/5 * * * *',
  'select public.trigger_review_sync()'
);

-- -------------------------
-- 2. Google token refresh — every 45 minutes
--    Calls a token-refresh Edge Function for tokens expiring soon.
-- -------------------------
create or replace function public.refresh_expiring_tokens()
returns void as $$
declare
  r                  record;
  edge_function_url  text;
begin
  edge_function_url :=
    current_setting('app.settings.supabase_url', true)
    || '/functions/v1/token-refresh';

  for r in
    select user_id
    from public.user_google_tokens
    where token_expires_at < now() + interval '15 minutes'
  loop
    perform net.http_post(
      url     := edge_function_url,
      headers := jsonb_build_object(
        'Authorization',  'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',   'application/json'
      ),
      body    := jsonb_build_object('user_id', r.user_id)
    );
  end loop;
end;
$$ language plpgsql security definer;

select cron.schedule(
  'token-refresh',
  '*/45 * * * *',
  'select public.refresh_expiring_tokens()'
);

-- -------------------------
-- 3. Subscription status sync — every hour
--    Verifies subscription statuses against Paddle API via Edge Function.
-- -------------------------
select cron.schedule(
  'subscription-sync',
  '0 * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.settings.supabase_url', true) || '/functions/v1/billing',
      headers := jsonb_build_object(
        'Authorization',  'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',   'application/json'
      ),
      body    := '{"action":"sync_subscriptions"}'
    )
  $$
);

-- -------------------------
-- 4. Demo cache cleanup — daily at 3am UTC
-- -------------------------
select cron.schedule(
  'demo-cache-cleanup',
  '0 3 * * *',
  'select public.cleanup_demo_cache()'
);
