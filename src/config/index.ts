import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function parseIdList(raw: string | undefined): readonly number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value));
}

type TTelegramMode = 'polling' | 'webhook';

function parseTelegramMode(raw: string | undefined): TTelegramMode {
  return raw === 'webhook' ? 'webhook' : 'polling';
}

const telegramEnabled = envBool('TELEGRAM_ENABLED', false);
const telegramMode = parseTelegramMode(process.env.TELEGRAM_MODE);

if (telegramEnabled) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_ENABLED=true but TELEGRAM_BOT_TOKEN is not set');
  }
  if (!process.env.TELEGRAM_OWNER_USER_ID) {
    throw new Error('TELEGRAM_ENABLED=true but TELEGRAM_OWNER_USER_ID is not set');
  }
  if (telegramMode === 'webhook') {
    if (!process.env.TELEGRAM_WEBHOOK_URL) {
      throw new Error('TELEGRAM_MODE=webhook but TELEGRAM_WEBHOOK_URL is not set');
    }
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      throw new Error('TELEGRAM_MODE=webhook but TELEGRAM_WEBHOOK_SECRET is not set');
    }
  }
}

export const config = {
  port: envInt('PORT', 3001),
  supabase: {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  openRouter: {
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    model: process.env.LLM_MODEL || 'qwen/qwen-2.5-72b-instruct',
  },
  embedding: {
    apiKey: requireEnv('EMBEDDING_API_KEY'),
    apiUrl: process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  rag: {
    matchThreshold: envFloat('RAG_MATCH_THRESHOLD', 0.3),
  },
  telegram: {
    enabled: telegramEnabled,
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    mode: telegramMode,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
    ownerUserId: process.env.TELEGRAM_OWNER_USER_ID ?? '',
    allowedTelegramIds: parseIdList(process.env.TELEGRAM_ALLOWED_USERS),
    rateLimitPerMinute: envInt('TELEGRAM_RATE_LIMIT_PER_MIN', 3),
    rateLimitPerDay: envInt('TELEGRAM_RATE_LIMIT_PER_DAY', 50),
    freeQuota: envInt('TELEGRAM_FREE_QUOTA', 5),
  },
} as const;
