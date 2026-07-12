import { config, YE_HANDLE } from './config.js';
import { fetchNewTweets } from './poller.js';
import { hasSeenTweet, markSeen, recordStory, getState, setState } from './db.js';
import { isDuplicateStory } from './dedupe.js';
import { rewriteNews, commentOnYe } from './rewrite.js';
import { composeNews, composeYeComment } from './compose.js';
import { postTweet, quoteTweet } from './poster.js';

const CURSOR_KEY = 'poll_since_unix';

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// Process a single tweet through the full pipeline. Errors are isolated per
// tweet so one bad tweet never kills the loop.
async function handleTweet(tweet) {
  // Fast-path dedup: already examined?
  if (await hasSeenTweet(tweet.id)) return;
  // Record immediately so we never process it twice, even across restarts.
  await markSeen(tweet.id, tweet.author);

  const isYe = tweet.author.toLowerCase() === YE_HANDLE.toLowerCase();

  if (isYe) {
    // Ye's own posts are always quote-tweeted with commentary.
    const { body, summary } = await commentOnYe(tweet);
    const { text } = composeYeComment({ body });

    if (config.dryRun) {
      log('[DRY_RUN] QUOTE-TWEET of', tweet.url);
      log('  →', JSON.stringify(text));
      return;
    }

    const postedId = await quoteTweet(text, tweet.id);
    await recordStory({
      sourceTweetId: tweet.id,
      sourceHandle: tweet.author,
      summary,
      postedTweetId: postedId,
      postedText: text,
    });
    log('Quote-tweeted Ye:', postedId);
    return;
  }

  // Semantic dedup against the last 48h of stories.
  if (await isDuplicateStory(tweet)) {
    log('Skipping duplicate story from @' + tweet.author, tweet.url);
    return;
  }

  const rewritten = await rewriteNews(tweet);
  const { text, withinLimit } = composeNews({
    prefix: rewritten.prefix,
    body: rewritten.body,
    handle: tweet.author,
    mediaLink: tweet.media ? tweet.media.link : null,
    insider: rewritten.insider,
  });

  if (!withinLimit) {
    log('Skipping — could not fit under limit for', tweet.url);
    return;
  }

  if (config.dryRun) {
    log('[DRY_RUN] POST (via @' + tweet.author + '):');
    log('  →', JSON.stringify(text));
    return;
  }

  const postedId = await postTweet(text);
  await recordStory({
    sourceTweetId: tweet.id,
    sourceHandle: tweet.author,
    summary: rewritten.summary,
    postedTweetId: postedId,
    postedText: text,
  });
  log('Posted:', postedId);
}

let running = false;

async function tick() {
  // Overlap guard: if the previous tick is still running (slow Sonnet/post),
  // skip this one rather than double-processing.
  if (running) {
    log('Previous tick still running, skipping.');
    return;
  }
  running = true;
  try {
    let since = parseInt((await getState(CURSOR_KEY)) || '0', 10);
    if (!since) {
      // First run: only look at recent tweets so we don't blast a backlog.
      since = nowUnix() - config.maxTweetAgeSeconds;
    }

    const tweets = await fetchNewTweets(since);
    // Process oldest first so posting order matches real-world order.
    tweets.sort((a, b) => a.id.localeCompare(b.id));

    let maxTs = since;
    for (const tweet of tweets) {
      try {
        await handleTweet(tweet);
      } catch (err) {
        log('Error handling tweet', tweet.id, '-', err.message);
      }
      const ts = Date.parse(tweet.createdAt);
      if (!Number.isNaN(ts)) maxTs = Math.max(maxTs, Math.floor(ts / 1000));
    }

    // Advance the cursor. Subtract a small overlap so we don't miss tweets that
    // arrive with the same second as the last one we saw.
    const nextSince = Math.max(since, maxTs - 5);
    await setState(CURSOR_KEY, String(nextSince));
  } catch (err) {
    log('Tick error:', err.message);
  } finally {
    running = false;
  }
}

async function main() {
  log('Ye News bot starting.');
  log('Watching:', config.watchAccounts.map((h) => '@' + h).join(', '));
  log('Poll interval:', config.pollIntervalMs + 'ms');
  log('Mode:', config.dryRun ? 'DRY_RUN (no posting)' : 'LIVE (posting enabled)');

  await tick();
  setInterval(tick, config.pollIntervalMs);
}

main().catch((err) => {
  log('Fatal:', err);
  process.exit(1);
});
