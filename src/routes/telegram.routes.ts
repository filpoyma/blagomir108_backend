import { Router } from 'express';
import { webhookCallback } from 'grammy';
import type { TBot } from '../bot';

export function createTelegramRouter(bot: TBot, secretToken: string): Router {
  const router = Router();
  router.post('/webhook', webhookCallback(bot, 'express', { secretToken, timeoutMilliseconds: 60_000, }));
  return router;
}
