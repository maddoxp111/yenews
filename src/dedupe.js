import { structured } from './llm.js';
import { getRecentStories } from './db.js';

const DEDUP_SCHEMA = {
  type: 'object',
  properties: {
    duplicate: { type: 'boolean' },
  },
  required: ['duplicate'],
  additionalProperties: false,
};

const DEDUP_SYSTEM = `You decide whether a new tweet reports the SAME underlying Ye (Kanye West) news story as something already posted.

Return {"duplicate": true} only if the new tweet is about the same specific story/event/announcement/leak as one of the recent posts — even if worded differently or from a different account. Multiple fan accounts often report the same leak; those are duplicates.

Return {"duplicate": false} if it's a genuinely different story, a new development, or unrelated commentary.`;

// Returns true if this tweet is semantically the same story as something we've
// posted in the last 48h. Cheap fast-path: if there are no recent stories,
// nothing can be a duplicate.
export async function isDuplicateStory(tweet) {
  const recent = await getRecentStories(48);
  if (recent.length === 0) return false;

  const recentList = recent
    .map((s, i) => `${i + 1}. ${s.summary}`)
    .join('\n');

  const result = await structured({
    system: DEDUP_SYSTEM,
    user: `Recently posted stories:\n${recentList}\n\nNew tweet from @${tweet.author}:\n"""${tweet.text}"""\n\nIs the new tweet the same story as any of the recent posts?`,
    schema: DEDUP_SCHEMA,
    maxTokens: 50,
  });

  return Boolean(result.duplicate);
}
