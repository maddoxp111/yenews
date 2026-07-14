import { structured } from './llm.js';
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
- Don't invent facts. Only use what's in the source tweet, the attached image, and any quoted tweet.

CONTEXT — the caption alone is often NOT the story:
- If an image is attached, READ IT. Fan pages put the actual substance (screenshots of texts/comments, leaked photos, tracklists, DMs) in the image. Base your post on what the image actually shows, not just the caption.
- If a quoted tweet is provided, use it to understand what the post is reacting to.
- If, even after reading the image and quoted tweet, you genuinely can't tell what the real news/story is (it's a vague reaction, an inside joke, or context-free), set skip=true and say why in skip_reason. A real news page stays quiet rather than posting something vague. Otherwise set skip=false.

You must return JSON with:
- skip: true if you can't determine a clear, postable story; false otherwise.
- skip_reason: one short sentence on why you're skipping (empty string if not skipping).
- type: "news" (a factual report/leak/announcement) or "commentary" (opinion/reaction/discussion).
- prefix: one of ${NEWS_PREFIXES.join(', ')}. Pick the one that best fits. LEAKED for leaks, BREAKING for major/urgent news, NEW for fresh announcements, REPORT for reported info, WATCH/FIRST LOOK for video/visual drops, UPDATE for developments, CONFIRMED for confirmations.
- body: the rewritten post text WITHOUT the prefix and WITHOUT any "(via @...)" credit. Keep it tight — aim for under ~200 characters. (Fill in your best attempt even if skipping.)
- insider: true if this reads like insider/scoop/leak/exclusive info.
- summary: a plain one-sentence description of the underlying story, for de-duplication. Not for posting.`;

const NEWS_SCHEMA = {
  type: 'object',
  properties: {
    skip: { type: 'boolean' },
    skip_reason: { type: 'string' },
    type: { type: 'string', enum: ['news', 'commentary'] },
    prefix: { type: 'string', enum: NEWS_PREFIXES },
    body: { type: 'string' },
    insider: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['skip', 'skip_reason', 'type', 'prefix', 'body', 'insider', 'summary'],
  additionalProperties: false,
};

const YE_SYSTEM = `You run a popular Ye (Kanye West) fan news account on X/Twitter. Ye himself just posted. You are quote-tweeting him with a short reaction/comment.

VOICE — sound like a real Ye fan page run by a person, NOT like an AI:
- Short, punchy reaction or context. Like a fan/news page commenting on what Ye said.
- No news prefix (NEW:/BREAKING: etc). No "(via @...)" credit — you're quoting him directly.
- No em-dashes, no hashtags, minimal/no emoji. Don't hedge.
- Don't just repeat his tweet back. Add a take, context, or reaction.
- If an image is attached, read it and factor in what it shows.

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

// Build the user message content for OpenAI. When the tweet has an image we
// return a multimodal content array (text + image) so GPT-4o vision reads it;
// otherwise a plain string.
function buildContent(textBlock, imageUrl) {
  if (!imageUrl) return textBlock;
  return [
    { type: 'text', text: textBlock },
    { type: 'image_url', image_url: { url: imageUrl } },
  ];
}

function contextLines(tweet) {
  let s = `Source account: @${tweet.author}\nHas media: ${tweet.media ? 'yes (image attached below — read it)' : 'no'}`;
  if (tweet.quoted) {
    s += `\nThis tweet QUOTES @${tweet.quoted.author}: """${tweet.quoted.text}"""`;
  }
  return s;
}

// Rewrite a source tweet into our news voice. Returns
// { skip, skip_reason, type, prefix, body, insider, summary }.
export async function rewriteNews(tweet) {
  const text = `${contextLines(tweet)}\n\nSource tweet:\n"""${tweet.text}"""`;
  return structured({
    system: NEWS_SYSTEM,
    user: buildContent(text, tweet.media?.imageUrl),
    schema: NEWS_SCHEMA,
  });
}

// Write a quote-tweet comment for one of Ye's own posts.
// Returns { body, summary }.
export async function commentOnYe(tweet) {
  let text = `Ye (@${YE_HANDLE}) just posted:\n"""${tweet.text}"""`;
  if (tweet.quoted) {
    text += `\n\n(He is quoting @${tweet.quoted.author}: """${tweet.quoted.text}""")`;
  }
  return structured({
    system: YE_SYSTEM,
    user: buildContent(text, tweet.media?.imageUrl),
    schema: YE_SCHEMA,
  });
}
