import type { MiddlewareFn } from 'grammy';
import { config } from '../../config';
import type { IBotContext } from '../types';
import { isUnlimitedTelegramUser } from '../utils/unlimited';

interface IRateBucket {
  minute: number[];
  day: number[];
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

const buckets = new Map<number, IRateBucket>();

function pruneAndCheck(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  let firstKept = 0;
  while (firstKept < timestamps.length && timestamps[firstKept] < cutoff) {
    firstKept++;
  }
  return firstKept === 0 ? timestamps : timestamps.slice(firstKept);
}

export const rateLimitMiddleware: MiddlewareFn<IBotContext> = async (ctx, next) => {
  if (ctx.callbackQuery) {
    await next();
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  if (isUnlimitedTelegramUser(userId)) {
    await next();
    return;
  }

  const now = Date.now();
  const bucket = buckets.get(userId) ?? { minute: [], day: [] };
  bucket.minute = pruneAndCheck(bucket.minute, now, MINUTE_MS);
  bucket.day = pruneAndCheck(bucket.day, now, DAY_MS);

  if (bucket.minute.length >= config.telegram.rateLimitPerMinute) {
    buckets.set(userId, bucket);
    await ctx.reply('Слишком много запросов в минуту. Попробуйте через минуту.');
    return;
  }
  if (bucket.day.length >= config.telegram.rateLimitPerDay) {
    buckets.set(userId, bucket);
    await ctx.reply('Дневной лимит запросов исчерпан. Попробуйте завтра.');
    return;
  }

  bucket.minute.push(now);
  bucket.day.push(now);
  buckets.set(userId, bucket);

  await next();
};
