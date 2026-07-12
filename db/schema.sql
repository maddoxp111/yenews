-- Ye News Bot — Supabase schema.
-- Run this if you're setting up a fresh Supabase project.

create table if not exists yenews_seen_tweets (
  tweet_id text primary key,
  author text not null,
  seen_at timestamptz not null default now()
);

create table if not exists yenews_posted_stories (
  id bigint generated always as identity primary key,
  source_tweet_id text not null,
  source_handle text not null,
  summary text not null,          -- Sonnet's one-line story summary (for dedup)
  posted_tweet_id text,
  posted_text text,
  created_at timestamptz not null default now()
);
create index if not exists yenews_posted_stories_created_at_idx
  on yenews_posted_stories (created_at desc);

create table if not exists yenews_bot_state (
  key text primary key,           -- e.g. poll_since_unix, login_cookie
  value text,
  updated_at timestamptz not null default now()
);
