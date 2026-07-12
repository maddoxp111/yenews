import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

const DRY_RUN = optional('DRY_RUN', 'true').toLowerCase() === 'true';

// Posting credentials are only strictly required when we're actually posting.
// In DRY_RUN mode the bot still runs the full read → rewrite → compose pipeline
// so you can eyeball the output before handing over your account credentials.
function postingCred(name) {
  return DRY_RUN ? optional(name, '') : required(name);
}

export const config = {
  twitterApiKey: required('TWITTERAPI_KEY'),
  openaiApiKey: required('OPENAI_API_KEY'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  post: {
    username: postingCred('POST_USERNAME'),
    email: postingCred('POST_EMAIL'),
    password: postingCred('POST_PASSWORD'),
    totpSecret: optional('POST_TOTP_SECRET', ''),
    proxy: postingCred('POST_PROXY'),
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
