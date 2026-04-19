-- ============================================================
-- Migration 000: Supabase roles and initial setup
-- This runs before all other migrations.
-- Required by PostgREST, GoTrue, Storage, and Realtime.
-- ============================================================

-- Create roles used by Supabase services (safe to run multiple times)
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin noinherit createrole createdb;
    grant all on database postgres to supabase_admin;
  end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin noinherit createrole login password 'postgres';
  end if;
  if not exists (select from pg_roles where rolname = 'supabase_storage_admin') then
    create role supabase_storage_admin noinherit createrole login password 'postgres';
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
  if not exists (select from pg_roles where rolname = 'dashboard_user') then
    create role dashboard_user noinherit createrole createdb;
  end if;
end $$;

-- Grant roles
grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;
grant supabase_admin to authenticator;

-- Grant schema permissions
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to supabase_admin;

-- Enable required extensions
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists pgcrypto schema extensions;
create extension if not exists pgjwt schema extensions;

-- Allow public schema access for extensions
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- JWT helper function (used by RLS policies with auth.uid())
create schema if not exists auth;

create or replace function auth.uid() returns uuid as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
$$ language sql stable;

create or replace function auth.email() returns text as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.email', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text
$$ language sql stable;

-- Grant auth schema usage
grant usage on schema auth to anon, authenticated, service_role;
