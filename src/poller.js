import { config } from './config.js';

const BASE = 'https://api.twitterapi.io';

// twitterapi.io's free tier caps requests at 1 every 5 seconds. Space out
// paginated requests so we never trip the QPS limit.
const PAGE_DELAY_MS = 5500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build one advanced-search query covering every watched account:
//   from:a OR from:b OR ... since_time:<unix>
// twitterapi.io's advanced search mirrors X's search operators.
function buildQuery(sinceUnix) {
  const froms = config.watchAccounts.map((h) => `from:${h}`).join(' OR ');
  return `(${froms}) since_time:${sinceUnix}`;
}

// Pull a media link out of a tweet if it has a photo/video. Appending another
// tweet's pic.twitter.com / t.co media link to your own post makes X render the
// media inline — the classic fan-page trick. We prefer the tweet's own short
// media URL, falling back to the tweet URL itself.
function extractMediaLink(tweet) {
  const media =
    tweet.extendedEntities?.media ||
    tweet.entities?.media ||
    tweet.extended_entities?.media ||
    [];
  if (Array.isArray(media) && media.length > 0) {
    const first = media[0];
    const link = first.url || first.expanded_url || first.media_url_https;
    if (link) return { link, type: first.type || 'photo' };
  }
  return null;
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
    media: extractMediaLink(tweet),
  };
}

async function twitterApiGet(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { 'X-API-Key': config.twitterApiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`twitterapi.io ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
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
    if (page > 0) await sleep(PAGE_DELAY_MS);
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
