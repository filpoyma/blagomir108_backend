import type { MiddlewareFn } from 'grammy';
import { touchTelegramUser } from '../../services/telegram-users.service';
import type { IBotContext } from '../types';

export const trackingMiddleware: MiddlewareFn<IBotContext> = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    void touchTelegramUser(userId);
  }
  await next();
};
