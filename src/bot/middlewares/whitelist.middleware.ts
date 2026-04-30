import type { MiddlewareFn } from 'grammy';
import { config } from '../../config';
import type { IBotContext } from '../types';

const allowed = new Set<number>(config.telegram.allowedTelegramIds);

export const whitelistMiddleware: MiddlewareFn<IBotContext> = async (ctx, next) => {
  if (allowed.size === 0) {
    await next();
    return;
  }

  const userId = ctx.from?.id;
  if (userId && allowed.has(userId)) {
    await next();
    return;
  }

  console.warn(`[bot] ${ctx.state?.requestId ?? '?'} blocked by whitelist: from=${userId ?? '?'}`);
  await ctx.reply('Этот бот сейчас доступен ограниченному кругу пользователей.');
};
