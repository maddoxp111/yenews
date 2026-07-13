import 'dotenv/config';

// Keys/secrets must be plain ASCII — they go into HTTP headers, which reject
// any character > 255 (a common paste artifact is a "smart" quote or a bullet
// "•" sneaking into a value). Catch it here with a clear message naming the
// variable and position, instead of a cryptic per-request ByteString crash.
function assertAscii(name, value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 127) {
      throw new Error(
        `Environment variable ${name} contains a non-ASCII character ` +
          `(code ${code}, "${value[i]}") at position ${i}. This is almost ` +
          `certainly a copy-paste artifact — delete and re-type/paste the value.`,
      );
    }
  }
  return value;
}

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return assertAscii(name, value.trim());
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() !== '' ? assertAscii(name, value.trim()) : fallback;
}

const DRY_RUN = optional('DRY_RUN', 'true').toLowerCase() === 'true';

// Posting credentials are only strictly required when we're actually posting.
// In DRY_RUN mode the bot still runs the full read → rewrite → compose pipeline
// so you can eyeball the output before adding your X API keys.
function postingCred(name) {
  return DRY_RUN ? optional(name, '') : required(name);
}

export const config = {
  twitterApiKey: required('TWITTERAPI_KEY'),
  openaiApiKey: required('OPENAI_API_KEY'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  // Official X API v2 posting — OAuth 1.0a user-context credentials.
  x: {
    apiKey: postingCred('X_API_KEY'),
    apiSecret: postingCred('X_API_SECRET'),
    accessToken: postingCred('X_ACCESS_TOKEN'),
    accessSecret: postingCred('X_ACCESS_SECRET'),
  },

  watchAccounts: optional(
    'WATCH_ACCOUNTS',
    'kanyewest,yeunrlsd,goodasssub,OnThatNoteTV,GhostTownYZY,yzyjohnny,TTVAuger,YE_TIMEZ',
  )
    .split(',')
    .map((h) => h.trim().replace(/^@/, ''))
    .filter(Boolean),

  pollIntervalMs: parseInt(optional('POLL_INTERVAL_MS', '30000'), 10),
  maxTweetAgeSeconds: parseInt(optional('MAX_TWEET_AGE_SECONDS', '300'), 10),
  rewriteModel: optional('REWRITE_MODEL', 'gpt-4o'),
  dryRun: DRY_RUN,
};

// The account we treat as "Ye himself" — his posts are quote-tweeted instead
// of rewritten as news. Match case-insensitively.
export const YE_HANDLE = 'kanyewest';

// Max characters for a composed post. The user asked to stay under 278.
export const MAX_POST_CHARS = 278;

// X counts every t.co link as 23 characters regardless of the real length.
export const TCO_LENGTH = 23;
