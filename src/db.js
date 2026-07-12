import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});

// ── seen_tweets ────────────────────────────────────────────────
// Every tweet we examine gets recorded immediately, so a restart never
// re-processes (or double-posts) anything we've already looked at.

export async function hasSeenTweet(tweetId) {
  const { data, error } = await supabase
    .from('yenews_seen_tweets')
    .select('tweet_id')
    .eq('tweet_id', tweetId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function markSeen(tweetId, author) {
  // Upsert so concurrent/overlapping runs don't error on the primary key.
  const { error } = await supabase
    .from('yenews_seen_tweets')
    .upsert({ tweet_id: tweetId, author }, { onConflict: 'tweet_id' });
  if (error) throw error;
}

// ── posted_stories ─────────────────────────────────────────────
// One row per story we've actually broken. `summary` is Sonnet's one-line
// description of the story, used for semantic dedup against later tweets.

export async function getRecentStories(hours = 48) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('yenews_posted_stories')
    .select('summary, source_handle, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function recordStory({
  sourceTweetId,
  sourceHandle,
  summary,
  postedTweetId,
  postedText,
}) {
  const { error } = await supabase.from('yenews_posted_stories').insert({
    source_tweet_id: sourceTweetId,
    source_handle: sourceHandle,
    summary,
    posted_tweet_id: postedTweetId ?? null,
    posted_text: postedText ?? null,
  });
  if (error) throw error;
}

// ── bot_state (key/value) ──────────────────────────────────────
// Holds the poll cursor and the cached twitterapi.io login session.

export async function getState(key) {
  const { data, error } = await supabase
    .from('yenews_bot_state')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function setState(key, value) {
  const { error } = await supabase
    .from('yenews_bot_state')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw error;
}
