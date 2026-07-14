import { config } from './config.js';

const BASE = 'https://api.twitterapi.io';

// twitterapi.io's free tier caps requests at 1 every 5 seconds. A single global
// throttle serializes EVERY twitterapi.io call (poll pages + per-account history
// lookups) with a minimum gap, so we never trip the QPS limit no matter what.
const MIN_GAP_MS = 5500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let gate = Promise.resolve();
let lastCallAt = 0;
async function throttle() {
  const prev = gate;
  let release;
  gate = new Promise((r) => (release = r));
  await prev;
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCallAt));
  if (wait) await sleep(wait);
  lastCallAt = Date.now();
  return release;
}

// Build one advanced-search query covering every watched account:
//   from:a OR from:b OR ... since_time:<unix>
// twitterapi.io's advanced search mirrors X's search operators.
function buildQuery(sinceUnix) {
  const froms = config.watchAccounts.map((h) => `from:${h}`).join(' OR ');
  return `(${froms}) since_time:${sinceUnix}`;
}

// Pull media out of a tweet if it has a photo/video. We return two things:
//  - link: the short t.co / pic.twitter.com URL to append to our own post so X
//    renders the media inline (the classic fan-page trick).
//  - imageUrl: the direct pbs.twimg.com image URL, which we hand to GPT-4o
//    vision so it can actually READ the screenshot/photo (for videos this is
//    the thumbnail/poster frame). This is where the real story often lives.
function extractMedia(tweet) {
  const media =
    tweet.extendedEntities?.media ||
    tweet.entities?.media ||
    tweet.extended_entities?.media ||
    [];
  if (Array.isArray(media) && media.length > 0) {
    const first = media[0];
    const link = first.url || first.expanded_url || first.media_url_https || null;
    if (link) {
      return {
        link,
        imageUrl: first.media_url_https || null,
        type: first.type || 'photo',
      };
    }
  }
  return null;
}

// If a tweet quotes another tweet, its text + author is context the caption
// alone doesn't carry. twitterapi.io nests it in the same response — no extra
// call needed.
function extractQuoted(tweet) {
  const q = tweet.quoted_tweet;
  if (!q) return null;
  return {
    text: q.text || '',
    author: q.author?.userName || q.author?.screen_name || '',
  };
}

function normalize(tweet) {
  const author = tweet.author?.userName || tweet.author?.screen_name || '';
  return {
    id: String(tweet.id),
    text: tweet.text || '',
    author,
    createdAt: tweet.createdAt || tweet.created_at || '',
    url: tweet.url || `https://x.com/${author}/status/${tweet.id}`,
    isReply: Boolean(tweet.isReply || tweet.inReplyToId),
    isRetweet: Boolean(tweet.retweeted_tweet),
    isQuote: Boolean(tweet.quoted_tweet),
    media: extractMedia(tweet),
    quoted: extractQuoted(tweet),
  };
}

async function twitterApiGet(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const release = await throttle();
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': config.twitterApiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`twitterapi.io ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  } finally {
    release();
  }
}

// Fetch a watched account's recent tweets, so the rewriter can understand
// follow-ups and the ongoing story around a new post. Cached per account for a
// few minutes to avoid hammering the API (and the QPS limit) when an account
// posts several times in a row.
const historyCache = new Map(); // handle -> { at, tweets }
const HISTORY_TTL_MS = 5 * 60 * 1000;

export async function fetchUserRecentTweets(handle, limit = 8) {
  const key = handle.toLowerCase();
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < HISTORY_TTL_MS) return cached.tweets;

  const data = await twitterApiGet('/twitter/user/last_tweets', {
    userName: handle,
  });
  const raw = data.tweets || data.data?.tweets || [];
  const tweets = raw
    .slice(0, limit)
    .map((t) => ({ id: String(t.id), text: t.text || '' }))
    .filter((t) => t.text);
  historyCache.set(key, { at: Date.now(), tweets });
  return tweets;
}

// Fetch tweets from the watched accounts posted at or after `sinceUnix`
// (a Unix timestamp in seconds). Returns newest-relevant original tweets,
// filtered to skip replies and pure retweets.
export async function fetchNewTweets(sinceUnix) {
  const query = buildQuery(sinceUnix);
  const collected = [];
  let cursor = '';

  // One page (20 tweets) is almost always enough at a 30s cadence, but page a
  // couple of times in case several accounts posted at once. Space out pages
  // to respect the free-tier 1-request-per-5-seconds limit.
  for (let page = 0; page < 3; page++) {
    const data = await twitterApiGet('/twitter/tweet/advanced_search', {
      query,
      queryType: 'Latest',
      cursor,
    });

    const tweets = data.tweets || [];
    for (const raw of tweets) {
      const t = normalize(raw);
      if (t.isReply) continue; // don't report replies
      if (t.isRetweet) continue; // don't report pure retweets
      collected.push(t);
    }

    if (!data.has_next_page || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return collected;
}
