import { TwitterApi } from 'twitter-api-v2';
import { config } from './config.js';

// Official X API v2 posting with OAuth 1.0a user-context credentials.
// This posts as your account with no "automated" label, needs no proxy, and
// is the supported/stable way to post. Free tier allows ~17 posts/day.
let client = null;
function getClient() {
  if (!client) {
    client = new TwitterApi({
      appKey: config.x.apiKey,
      appSecret: config.x.apiSecret,
      accessToken: config.x.accessToken,
      accessSecret: config.x.accessSecret,
    });
  }
  return client;
}

// Post a plain tweet. Returns the new tweet id.
export async function postTweet(text) {
  const res = await getClient().v2.tweet(text);
  return res?.data?.id ?? null;
}

// Quote-tweet an existing tweet with commentary. Returns the new tweet id.
export async function quoteTweet(text, quotedTweetId) {
  const res = await getClient().v2.tweet(text, { quote_tweet_id: quotedTweetId });
  return res?.data?.id ?? null;
}
