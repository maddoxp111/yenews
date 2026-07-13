# Ye News Bot

An automated X/Twitter bot that posts Ye (Kanye West) news from your own account
like a regular user. It watches a set of source accounts and, within ~1 minute
of a new post, it:

1. Reads the new tweet.
2. Checks it hasn't already broken this news/commentary (dedup).
3. Grabs the photo/video link if the tweet has media.
4. Rewrites it with **OpenAI GPT** in a natural fan-news-page voice.
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
  third-party API that can search tweets (the official free X API can't read
  broadly).
- **Posting** uses the **official X API v2** (OAuth 1.0a user context). Posts
  appear as normal posts from your account — the "Automated" label is opt-in
  and off by default. No proxy, no password sharing.
- **Rewriting** uses the OpenAI API (GPT, default `gpt-4o`).
- **State** (seen tweets, posted stories, poll cursor) lives in **Supabase**
  (Postgres).
- Designed to run 24/7 on **Railway** (or any always-on Node host).

### ⚠️ Please read this before going live

- The X API **free tier caps posting at ~17/day (500/month)**. Fine for normal
  Ye-news volume; on album-drop days you may hit the daily cap. Upgrade to X API
  Basic if you need more.
- Running an automated posting account can still run afoul of X's automation
  rules — use an account you're comfortable running this way, and keep
  `DRY_RUN=true` until you've watched the logs and are happy with the output.

## Watched accounts

Default (editable via `WATCH_ACCOUNTS`):

`@kanyewest` (Ye himself), `@yeunrlsd`, `@goodasssub`, `@OnThatNoteTV`,
`@GhostTownYZY`, `@yzyjohnny`, `@TTVAuger`, `@YE_TIMEZ`

## Setup

### 1. twitterapi.io (reading the watched accounts)
1. Sign up at https://twitterapi.io and grab your **API key** →
   `TWITTERAPI_KEY`. Add a few dollars of credit.

### 1b. Official X API (posting)
On the account you want to post from:
1. Go to https://developer.x.com → sign up for a free developer account.
2. Create a **Project** and an **App** inside it.
3. In the App's **Settings → User authentication settings**, set **App
   permissions** to **Read and write**, App type **Web/Automated** (any), and
   save. (This must be done *before* generating tokens.)
4. In **Keys and tokens**, generate/copy all four:
   - **API Key** → `X_API_KEY`
   - **API Key Secret** → `X_API_SECRET`
   - **Access Token** → `X_ACCESS_TOKEN`
   - **Access Token Secret** → `X_ACCESS_SECRET`
   The Access Token/Secret must be generated **after** setting Read+Write, or
   posting returns a 403. If you flipped permissions later, regenerate them.

### 2. OpenAI (rewriting)
1. Sign up at https://platform.openai.com.
2. Add a little credit (Billing), then create an API key at
   https://platform.openai.com/api-keys → `OPENAI_API_KEY`.

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
- `REWRITE_MODEL` — OpenAI model, defaults to `gpt-4o` (`gpt-4o-mini` is cheaper).

## Costs (rough)

- twitterapi.io (reads): ~$10–15/mo at 30s polling.
- X API (posting): free tier ($0), ~17 posts/day cap.
- Railway: ~$5/mo.
- OpenAI: a few dollars/mo at typical volume.
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
  dedupe.js    tweet-ID + GPT "same story?" checks
  rewrite.js   GPT rewrite / Ye quote-tweet comment
  compose.js   assembles the final post, enforces <= 278 chars
  poster.js    official X API v2 post + quote tweet (twitter-api-v2)
  llm.js       shared OpenAI client + structured-output helper
  db.js        Supabase state (seen tweets, posted stories, session)
```
