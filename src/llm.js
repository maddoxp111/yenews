import OpenAI from 'openai';
import { config } from './config.js';

export const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Helper: run a request that must return JSON matching `schema`, and return the
// parsed object. Uses OpenAI structured outputs (response_format json_schema,
// strict) so we get guaranteed-parseable JSON back.
export async function structured({ system, user, schema, maxTokens = 400 }) {
  const completion = await openai.chat.completions.create({
    model: config.rewriteModel,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'result', strict: true, schema },
    },
  });
  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned no content');
  return parseJson(text);
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
