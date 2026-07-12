import { structured } from './anthropic.js';
import { YE_HANDLE } from './config.js';

const NEWS_PREFIXES = [
  'NEW',
  'BREAKING',
  'REPORT',
  'LEAKED',
  'UPDATE',
  'WATCH',
  'FIRST LOOK',
  'CONFIRMED',
];

const NEWS_SYSTEM = `You run a popular Ye (Kanye West) fan news account on X/Twitter. You rewrite tips and reports from other accounts into your own short, punchy posts.

VOICE — sound like a real hip-hop/Ye news page run by a person, NOT like an AI:
- Direct and declarative. No hedging ("reportedly", "it appears", "seemingly").
- No em-dashes. No corporate or explainer tone. No hashtags. No emoji spam (at most one, usually none).
- Never say "the tweet says" or reference the source account inside the body.
- Present tense for news. Get to the point in the first few words.
- Don't invent facts. Only use what's in the source tweet.

You must return JSON with:
- type: "news" (a factual report/leak/announcement) or "commentary" (opinion/reaction/discussion).
- prefix: one of ${NEWS_PREFIXES.join(', ')}. Pick the one that best fits. Use LEAKED for leaks, BREAKING for major/urgent news, NEW for fresh announcements, REPORT for reported info, WATCH/FIRST LOOK for video/visual drops, UPDATE for developments, CONFIRMED for confirmations.
- body: the rewritten post text WITHOUT the prefix and WITHOUT any "(via @...)" credit. Keep it tight — aim for under ~200 characters so there's room for the prefix and credit.
- insider: true if this reads like insider/scoop/leak/exclusive info (not just public commentary).
- summary: a plain one-sentence description of the underlying story, for de-duplication. Not for posting.`;

const NEWS_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['news', 'commentary'] },
    prefix: { type: 'string', enum: NEWS_PREFIXES },
    body: { type: 'string' },
    insider: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['type', 'prefix', 'body', 'insider', 'summary'],
  additionalProperties: false,
};

const YE_SYSTEM = `You run a popular Ye (Kanye West) fan news account on X/Twitter. Ye himself just posted. You are quote-tweeting him with a short reaction/comment.

VOICE — sound like a real Ye fan page run by a person, NOT like an AI:
- Short, punchy reaction or context. Like a fan/news page commenting on what Ye said.
- No news prefix (NEW:/BREAKING: etc). No "(via @...)" credit — you're quoting him directly.
- No em-dashes, no hashtags, minimal/no emoji. Don't hedge.
- Don't just repeat his tweet back. Add a take, context, or reaction.

Return JSON with:
- body: your quote-tweet comment (aim for under ~200 characters).
- summary: a plain one-sentence description of what Ye posted, for de-duplication.`;

const YE_SCHEMA = {
  type: 'object',
  properties: {
    body: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['body', 'summary'],
  additionalProperties: false,
};

// Rewrite a source tweet into our news voice. Returns
// { type, prefix, body, insider, summary }.
export async function rewriteNews(tweet) {
  return structured({
    system: NEWS_SYSTEM,
    user: `Source account: @${tweet.author}\nHas media: ${tweet.media ? 'yes' : 'no'}\n\nSource tweet:\n"""${tweet.text}"""`,
    schema: NEWS_SCHEMA,
  });
}

// Write a quote-tweet comment for one of Ye's own posts.
// Returns { body, summary }.
export async function commentOnYe(tweet) {
  return structured({
    system: YE_SYSTEM,
    user: `Ye (@${YE_HANDLE}) just posted:\n"""${tweet.text}"""`,
    schema: YE_SCHEMA,
  });
}
