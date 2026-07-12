import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightedLength, composeNews, composeYeComment } from '../src/compose.js';
import { MAX_POST_CHARS } from '../src/config.js';

test('weightedLength counts links as 23 chars', () => {
  assert.equal(weightedLength('hello'), 5);
  // A long link counts as 23, not its literal length.
  const link = 'https://pic.twitter.com/abcdefghijklmnopqrstuvwxyz1234567890';
  assert.equal(weightedLength(link), 23);
  assert.equal(weightedLength('news ' + link), 5 + 23);
});

test('composeNews builds prefix + body + credit', () => {
  const { text, withinLimit } = composeNews({
    prefix: 'NEW',
    body: 'Ye spotted in Tokyo working on a new album',
    handle: 'yeunrlsd',
    mediaLink: null,
    insider: true,
  });
  assert.ok(text.startsWith('NEW: '));
  assert.ok(text.includes('(via @yeunrlsd)'));
  assert.ok(text.includes('\n\n(via'));
  assert.ok(withinLimit);
});

test('composeNews includes media link inline and shows credit', () => {
  const { text } = composeNews({
    prefix: 'WATCH',
    body: 'New footage of Ye at the listening party',
    handle: 'GhostTownYZY',
    mediaLink: 'https://pic.twitter.com/xyz123',
    insider: false,
  });
  assert.ok(text.includes('https://pic.twitter.com/xyz123'));
  assert.ok(text.includes('(via @GhostTownYZY)'));
});

test('composeNews omits credit when no media and not insider', () => {
  const { text } = composeNews({
    prefix: 'REPORT',
    body: 'Fans react to the latest snippet',
    handle: 'goodasssub',
    mediaLink: null,
    insider: false,
  });
  assert.ok(!text.includes('(via'));
});

test('composeNews trims an over-long body to fit the limit', () => {
  const longBody = Array(100).fill('word').join(' ');
  const { text, withinLimit } = composeNews({
    prefix: 'BREAKING',
    body: longBody,
    handle: 'YE_TIMEZ',
    mediaLink: 'https://pic.twitter.com/abc',
    insider: true,
  });
  assert.ok(withinLimit, 'should be trimmed under the limit');
  assert.ok(weightedLength(text) <= MAX_POST_CHARS);
  // Credit and media survive the trim.
  assert.ok(text.includes('(via @YE_TIMEZ)'));
  assert.ok(text.includes('https://pic.twitter.com/abc'));
});

test('composeNews stays under 278 with a link present', () => {
  const { text } = composeNews({
    prefix: 'LEAKED',
    body: 'A' .repeat(300),
    handle: 'TTVAuger',
    mediaLink: 'https://pic.twitter.com/zzz',
    insider: true,
  });
  assert.ok(weightedLength(text) <= MAX_POST_CHARS);
});

test('composeYeComment has no prefix or credit and fits', () => {
  const { text, withinLimit } = composeYeComment({
    body: 'This might be the most Ye thing he has ever said and we are here for it',
  });
  assert.ok(!text.includes(':'.repeat(1) + ' ') || !/^[A-Z]+:/.test(text));
  assert.ok(!text.includes('(via'));
  assert.ok(withinLimit);
});
