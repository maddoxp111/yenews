# Ye News Bot

An automated X/Twitter bot that posts Ye (Kanye West) news from your own account
like a regular user. It watches a set of source accounts and, within ~1 minute
of a new post, it:

1. Reads the new tweet.
2. Checks it hasn't already broken this news/commentary (dedup).
3. Grabs the photo/video link if the tweet has media.
4. Rewrites it with **Claude Sonnet 5** in a natural fan-news-page voice.
5. Posts it, starting news with `NEW:`, `BREAKING:`, `REPORT:`, `LEAKED:`, etc.
6. Quote-tweets any post by **Ye himself** (@kanyewest) with a comment instead.

Every post stays under 278 characters. When a post has media or insider news, it
adds two line breaks and a `(via @handle)` credit:

```
REPORT: Ye has spent all week in a Tokyo studio with a full band, and a new album is reportedly close https://pic.twitter.com/aB9xQ2

(via @yeunrlsd)
```

## How it works

- **Reads** come from [twitterapi.io](https://twitterapi.io) — a cheap
  third-party API that can search tweets (the official free X API cannot).
- **Posting** also goes through twitterapi.io, which logs into your account with
  a real session, so your posts look like normal user activity. **No X developer
  account or "Automated" label.**
- **Rewriting** uses the Anthropic API (Claude Sonnet 5).
- **State** (seen tweets, posted stories, login session) lives in **Supabase**
  (Postgres).
- Designed to run 24/7 on **Railway** (or any always-on Node host).

### ⚠️ Please read this before going live

Using twitterapi.io to post means:
- You share your X login (username, email, password, and ideally your 2FA/TOTP
  secret) with twitterapi.io.
- Automating posting is against X's Terms of Service, so there is a real risk of
  your account being limited or suspended. This is an account-level risk you're
  choosing to accept.

Use a dedicated account you're comfortable risking, and keep `DRY_RUN=true` until
you've watched the logs and are happy with the output.

## Watched accounts

Default (editable via `WATCH_ACCOUNTS`):

`@kanyewest` (Ye himself), `@yeunrlsd`, `@goodasssub`, `@OnThatNoteTV`,
`@GhostTownYZY`, `@yzyjohnny`, `@TTVAuger`, `@YE_TIMEZ`

## Setup

### 1. twitterapi.io (reads + posting)
1. Sign up at https://twitterapi.io and grab your **API key** →
   `TWITTERAPI_KEY`.
2. You'll also need a **residential proxy** for login/posting (twitterapi.io
   requires one). Format: `http://user:pass@ip:port` → `POST_PROXY`. Any
   residential proxy provider works.
3. Fill in your posting account's `POST_USERNAME`, `POST_EMAIL`,
   `POST_PASSWORD`, and — strongly recommended — `POST_TOTP_SECRET` (your 2FA
   secret in base32). Accounts without 2FA often get a login cookie that's
   flagged and can't post.

### 2. Anthropic (rewriting)
1. Sign up at https://console.anthropic.com.
2. Create an API key → `ANTHROPIC_API_KEY`.

### 3. Supabase (state)
The tables are already created in this project's Supabase database
(`yenews_seen_tweets`, `yenews_posted_stories`, `yenews_bot_state`). You just
need:
1. Your project URL → `SUPABASE_URL`.
2. Your **service_role** key (Settings → API) → `SUPABASE_SERVICE_KEY`.

If you're setting up a fresh Supabase project, run the SQL in
[`db/schema.sql`](db/schema.sql).

### 4. Run it

Locally (for a dry run):

```bash
npm install
cp .env.example .env   # fill in the values
npm start              # DRY_RUN=true by default — logs what it WOULD post
```

You'll see lines like:

```
[DRY_RUN] POST (via @yeunrlsd):
  → "REPORT: ... https://pic.twitter.com/... \n\n(via @yeunrlsd)"
```

### 5. Deploy to Railway
1. Push this repo to GitHub.
2. On https://railway.app, create a project from the repo.
3. Add all the environment variables from `.env.example` in the Railway
   dashboard.
4. Deploy. `railway.json` already sets the start command and restart policy.

### 6. Go live
1. Deploy with `DRY_RUN=true` first and watch the logs for a while.
2. When the output looks right, set `DRY_RUN=false` and redeploy.

## Tuning

All optional, via env vars (see `.env.example`):

- `WATCH_ACCOUNTS` — comma-separated handles to watch.
- `POLL_INTERVAL_MS` — how often to check (default 30000 = 30s).
- `MAX_TWEET_AGE_SECONDS` — on first start, ignore tweets older than this so a
  fresh deploy doesn't post a backlog (default 300).
- `REWRITE_MODEL` — defaults to `claude-sonnet-5`.

## Costs (rough)

- twitterapi.io: ~$10–15/mo at 30s polling, plus a fraction of a cent per post.
- Railway: ~$5/mo.
- Anthropic: a few dollars/mo at typical volume.
- Supabase: free tier.

## Tests

```bash
npm test   # unit tests for the character-limit / compose logic
```

(Set dummy env vars, or copy `.env.example` to `.env`, so config loads.)

## Project layout

```
src/
  index.js     main loop (poll → dedup → rewrite → compose → post)
  config.js    env parsing/validation
  poller.js    twitterapi.io advanced-search reads
  dedupe.js    tweet-ID + Sonnet "same story?" checks
  rewrite.js   Sonnet rewrite / Ye quote-tweet comment
  compose.js   assembles the final post, enforces <= 278 chars
  poster.js    twitterapi.io login session + create/quote tweet
  anthropic.js shared Anthropic client + structured-output helper
  db.js        Supabase state (seen tweets, posted stories, session)
```
