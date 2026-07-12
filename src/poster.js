import { config } from './config.js';
import { getState, setState } from './db.js';

const BASE = 'https://api.twitterapi.io';
const SESSION_KEY = 'login_cookie';

async function twitterApiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'X-API-Key': config.twitterApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `twitterapi.io ${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return json;
}

// Log in as the posting account and cache the returned login cookie in the DB
// so restarts reuse the session instead of forcing a fresh login every time.
async function login() {
  const body = {
    user_name: config.post.username,
    email: config.post.email,
    password: config.post.password,
    proxy: config.post.proxy,
  };
  if (config.post.totpSecret) body.totp_secret = config.post.totpSecret;

  const json = await twitterApiPost('/twitter/user_login_v2', body);
  const cookie = json.login_cookie || json.login_cookies;
  if (!cookie) {
    throw new Error(`login returned no cookie: ${JSON.stringify(json).slice(0, 200)}`);
  }
  await setState(SESSION_KEY, cookie);
  return cookie;
}

async function getLoginCookie(forceFresh = false) {
  if (!forceFresh) {
    const cached = await getState(SESSION_KEY);
    if (cached) return cached;
  }
  return login();
}

// Post a tweet. `opts` may include { quoteTweetId }.
// Automatically re-logs-in once if the cached session has expired.
// Returns the new tweet's id.
async function createTweet(text, opts = {}) {
  async function attempt(cookie) {
    const body = {
      login_cookies: cookie,
      tweet_text: text,
      proxy: config.post.proxy,
    };
    if (opts.quoteTweetId) body.quote_tweet_id = opts.quoteTweetId;
    return twitterApiPost('/twitter/create_tweet_v2', body);
  }

  let cookie = await getLoginCookie();
  let json;
  try {
    json = await attempt(cookie);
    if (json.status === 'error') throw new Error(json.msg || 'post error');
  } catch (err) {
    // Session likely expired/flagged — re-login once and retry.
    cookie = await getLoginCookie(true);
    json = await attempt(cookie);
    if (json.status === 'error') {
      throw new Error(`post failed after re-login: ${json.msg || 'unknown'}`);
    }
  }
  return json.tweet_id || null;
}

export async function postTweet(text) {
  return createTweet(text);
}

export async function quoteTweet(text, quotedTweetId) {
  return createTweet(text, { quoteTweetId: quotedTweetId });
}
