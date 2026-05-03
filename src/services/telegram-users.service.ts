import { config } from '../config';
import { supabaseAdmin } from '../config/supabase';

export interface ITelegramUserInput {
  telegramId: number;
  chatId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  isBot: boolean;
  isPremium?: boolean;
}

export interface IQuotaSnapshot {
  total: number;
  used: number;
  remaining: number;
  resetsAt: Date | null;
}

const TABLE = 'telegram_users';

/** Last completed health анкета (перезаписывается при новом прохождении). */
export interface ITelegramHealthFacts {
  bothering: string;
  whenWorse: string;
  severity: number;
  desiredResult: string;
  completedAt: string;
}

interface ITelegramUserRow {
  telegram_id: number;
  chat_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  language_code: string | null;
  is_bot: boolean;
  is_premium: boolean | null;
  started_at: string;
  last_seen_at: string;
  quota_total: number;
  quota_used: number;
  quota_resets_at: string | null;
  health_facts: unknown;
  last_sphere: string | null;
}

// Upsert profile fields and refresh last_seen_at. On INSERT, also seed quota_total
// from config.telegram.freeQuota (free tier). On UPDATE, quota fields are NOT touched
// so a repeated /start does not reset the user's balance.
export async function upsertTelegramUser(input: ITelegramUserInput): Promise<void> {
  const now = new Date().toISOString();
  const profilePayload = {
    telegram_id: input.telegramId,
    chat_id: input.chatId,
    username: input.username ?? null,
    first_name: input.firstName,
    last_name: input.lastName ?? null,
    language_code: input.languageCode ?? null,
    is_bot: input.isBot,
    is_premium: input.isPremium ?? null,
    last_seen_at: now,
  };

  const { data: existing, error: selectError } = await supabaseAdmin
    .from(TABLE)
    .select('telegram_id')
    .eq('telegram_id', input.telegramId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to read telegram_user: ${selectError.message}`);
  }

  if (existing) {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update(profilePayload)
      .eq('telegram_id', input.telegramId);
    if (error) {
      throw new Error(`Failed to update telegram_user: ${error.message}`);
    }
    return;
  }

  const { error } = await supabaseAdmin.from(TABLE).insert({
    ...profilePayload,
    started_at: now,
    quota_total: Math.max(0, config.telegram.freeQuota),
    quota_used: 0,
  });
  if (error) {
    throw new Error(`Failed to insert telegram_user: ${error.message}`);
  }
}

// Update last_seen_at for existing user. Silent no-op if user is absent.
// Never throws — must not break message handling on transient DB errors.
export async function touchTelegramUser(telegramId: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ last_seen_at: new Date().toISOString() })
    .eq('telegram_id', telegramId);
  if (error) {
    console.error(`touchTelegramUser(${telegramId}) failed:`, error.message);
  }
}

export async function getQuota(telegramId: number): Promise<IQuotaSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('quota_total, quota_used, quota_resets_at')
    .eq('telegram_id', telegramId)
    .maybeSingle<Pick<ITelegramUserRow, 'quota_total' | 'quota_used' | 'quota_resets_at'>>();

  if (error) {
    throw new Error(`Failed to read quota: ${error.message}`);
  }
  if (!data) return null;

  const total = data.quota_total;
  const used = data.quota_used;
  return {
    total,
    used,
    remaining: Math.max(0, total - used),
    resetsAt: data.quota_resets_at ? new Date(data.quota_resets_at) : null,
  };
}

// Atomic increment of quota_used, gated by `quota_used < quota_total`.
// Returns true when the row was actually updated (quota was available),
// false when quota was already exhausted by a concurrent consumer.
export async function consumeQuota(telegramId: number): Promise<boolean> {
  const { data: snapshot, error: readError } = await supabaseAdmin
    .from(TABLE)
    .select('quota_used, quota_total')
    .eq('telegram_id', telegramId)
    .maybeSingle<Pick<ITelegramUserRow, 'quota_used' | 'quota_total'>>();

  if (readError) {
    throw new Error(`consumeQuota read failed: ${readError.message}`);
  }
  if (!snapshot) return false;
  if (snapshot.quota_used >= snapshot.quota_total) return false;

  // Optimistic update: succeed only if quota_used hasn't moved since we read it.
  // This makes the increment safe under concurrent message bursts.
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update({ quota_used: snapshot.quota_used + 1 })
    .eq('telegram_id', telegramId)
    .eq('quota_used', snapshot.quota_used)
    .select('telegram_id');

  if (error) {
    throw new Error(`consumeQuota update failed: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function setTelegramUserHealthFacts(
  telegramId: number,
  facts: ITelegramHealthFacts
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ health_facts: facts })
    .eq('telegram_id', telegramId);

  if (error) {
    throw new Error(`Failed to save health_facts: ${error.message}`);
  }
}

export async function setTelegramUserLastSphere(
  telegramId: number,
  sphere: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ last_sphere: sphere })
    .eq('telegram_id', telegramId);

  if (error) {
    throw new Error(`Failed to save last_sphere: ${error.message}`);
  }
}
