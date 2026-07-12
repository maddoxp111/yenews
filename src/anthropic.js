import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

export const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// Helper: run a request that must return JSON matching `schema`, and return the
// parsed object. Uses structured outputs (output_config.format), which Sonnet 5
// supports, so we get guaranteed-parseable JSON back.
export async function structured({ system, user, schema, maxTokens = 400 }) {
  const response = await anthropic.messages.create({
    model: config.rewriteModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: {
      format: { type: 'json_schema', schema },
    },
  });
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('Anthropic returned no text block');
  return parseJson(block.text);
}

// Robust JSON parse: tolerate a model that wraps its answer in ```json fences
// or adds stray prose around the object.
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Could not parse JSON from model output: ' + text.slice(0, 200));
  }
}
