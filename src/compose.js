import { MAX_POST_CHARS, TCO_LENGTH } from './config.js';

// A rough URL matcher. Anything that looks like an http(s) link or a bare
// pic.twitter.com / t.co short link counts as a link for X's weighted length.
const URL_RE = /(https?:\/\/\S+|(?:pic\.twitter\.com|t\.co)\/\S+)/g;

// X counts every link as a fixed 23 characters, regardless of its real length.
// Everything else counts as its literal character count.
export function weightedLength(text) {
  const links = text.match(URL_RE) || [];
  let length = text.length;
  for (const link of links) {
    length = length - link.length + TCO_LENGTH;
  }
  return length;
}

// Assemble a news post:
//
//   PREFIX: body <mediaLink?>
//
//   (via @handle)
//
// The "(via @handle)" credit block (after two line breaks) is included when the
// source tweet had media OR the story was classified as insider news — per the
// spec. The media link, when present, is appended inline to the body so X
// renders the photo/video.
//
// Returns { text, withinLimit } where withinLimit reflects X's weighted count.
export function composeNews({ prefix, body, handle, mediaLink, insider }) {
  const showCredit = Boolean(mediaLink) || Boolean(insider);
  const credit = showCredit && handle ? `\n\n(via @${handle})` : '';

  function build(bodyText) {
    let head = `${prefix}: ${bodyText}`.trim();
    if (mediaLink) head = `${head} ${mediaLink}`;
    return `${head}${credit}`;
  }

  let text = build(body.trim());

  // If we're over the weighted limit, trim the body word by word until it fits.
  if (weightedLength(text) > MAX_POST_CHARS) {
    const words = body.trim().split(/\s+/);
    while (words.length > 1 && weightedLength(build(words.join(' '))) > MAX_POST_CHARS) {
      words.pop();
    }
    let trimmedBody = words.join(' ');
    // Last resort: if even one word is too long (no spaces to break on),
    // hard-slice the body until the whole post fits.
    while (trimmedBody.length > 0 && weightedLength(build(trimmedBody)) > MAX_POST_CHARS) {
      trimmedBody = trimmedBody.slice(0, -1);
    }
    text = build(trimmedBody);
  }

  return { text, withinLimit: weightedLength(text) <= MAX_POST_CHARS };
}

// Quote-tweet comment for Ye's own posts: just the comment text, no prefix,
// no credit. The quoted tweet carries the media.
export function composeYeComment({ body }) {
  let text = body.trim();
  if (weightedLength(text) > MAX_POST_CHARS) {
    const words = text.split(/\s+/);
    while (words.length > 1 && weightedLength(words.join(' ')) > MAX_POST_CHARS) {
      words.pop();
    }
    text = words.join(' ');
  }
  return { text, withinLimit: weightedLength(text) <= MAX_POST_CHARS };
}
