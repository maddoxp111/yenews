// Manual end-to-end pipeline check with a stubbed Anthropic call.
// Run: node test/pipeline.fixture.mjs
// It exercises rewrite → compose exactly as index.js would, but replaces the
// real Sonnet call with a canned response so it runs without an API key.

import { composeNews, composeYeComment } from '../src/compose.js';

// A couple of realistic source tweets.
const newsTweet = {
  author: 'yeunrlsd',
  text: 'Ye has been in the studio all week in Tokyo with a full band. Sources say a new album is close.',
  media: { link: 'https://pic.twitter.com/aB9xQ2', type: 'photo' },
};

const yeTweet = {
  author: 'kanyewest',
  text: 'MY NEW ALBUM IS DONE',
};

// Canned "Sonnet" output for the news tweet.
const rewritten = {
  type: 'news',
  prefix: 'REPORT',
  body: 'Ye has spent all week in a Tokyo studio with a full band, and a new album is reportedly close',
  insider: true,
  summary: 'Ye is recording a new album in Tokyo with a full band.',
};

const news = composeNews({
  prefix: rewritten.prefix,
  body: rewritten.body,
  handle: newsTweet.author,
  mediaLink: newsTweet.media.link,
  insider: rewritten.insider,
});

console.log('── NEWS POST ──');
console.log(news.text);
console.log(`(len ${news.text.length}, withinLimit ${news.withinLimit})\n`);

const yeComment = composeYeComment({
  body: 'He said it. Album is done. The wait is over.',
});
console.log('── YE QUOTE-TWEET ──');
console.log('quoting', `https://x.com/${yeTweet.author}/status/123`);
console.log(yeComment.text);
console.log(`(len ${yeComment.text.length}, withinLimit ${yeComment.withinLimit})`);
