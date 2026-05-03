import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from '../config';
import { loggingMiddleware } from './middlewares/logging.middleware';
import { whitelistMiddleware } from './middlewares/whitelist.middleware';
import { rateLimitMiddleware } from './middlewares/rateLimit.middleware';
import { trackingMiddleware } from './middlewares/tracking.middleware';
import { handleHelp, handleStart } from './handlers/start.handler';
import { handleHealthSurveyCallback } from './flows/health-survey.wizard';
import { handleSphereChoice } from './handlers/sphere.handler';
import { handleTextGenerate } from './handlers/generate.handler';
import type { IBotContext } from './types';

export type TBot = Bot<IBotContext>;

export function createBot(): TBot {
  if (!config.telegram.enabled) throw new Error('createBot called but config.telegram.enabled is false');

  const bot = new Bot<IBotContext>(config.telegram.botToken);

  bot.use(loggingMiddleware);
  bot.use(whitelistMiddleware);
  bot.use(rateLimitMiddleware);
  bot.use(trackingMiddleware);

  bot.command('start', handleStart);
  bot.command('help', handleHelp);

  bot.callbackQuery(/^health_/, handleHealthSurveyCallback);
  bot.callbackQuery(/^sphere_/, handleSphereChoice);

  bot.on('message:text', handleTextGenerate);

  bot.on('message', async (ctx) => {
    await ctx.reply('Я понимаю только текстовые запросы. Отправьте описание задачи текстом.');
  });

  bot.catch((err) => {
    const ctx = err.ctx;
    const requestId = ctx.state?.requestId ?? '?';
    if (err.error instanceof GrammyError) {
      console.error(`[bot] ${requestId} Telegram API error:`, err.error.description);
    } else if (err.error instanceof HttpError) {
      console.error(`[bot] ${requestId} network error:`, err.error.message);
    } else {
      console.error(`[bot] ${requestId} handler error:`, err.error);
    }
  });

  return bot;
}

// Long-polling lifecycle. Returns once polling stops (bot.stop() called elsewhere).
// Telegram allows either webhook OR getUpdates — never both. If a webhook was set
// earlier (prod / ngrok test), bot.start() throws; deleteWebhook first clears it.
export async function startBotPolling(bot: TBot): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.log('[bot] cleared existing webhook (if any); starting long polling');
  await bot.start({
    onStart: (info) => {
      console.log(`[bot] long polling started as @${info.username}`);
    },
  });
}

export async function configureWebhook(bot: TBot): Promise<void> {
  const url = config.telegram.webhookUrl;
  const secret = config.telegram.webhookSecret;
  if (!url || !secret) {
    throw new Error('configureWebhook called without webhookUrl/webhookSecret');
  }
  await bot.api.setWebhook(url, {
    secret_token: secret,
    drop_pending_updates: true,
  });
  console.log(`[bot] webhook registered at ${url}`);
}

export async function stopBot(bot: TBot): Promise<void> {
  try {
    await bot.stop();
    console.log('[bot] stopped');
  } catch (err) {
    console.error('[bot] failed to stop cleanly:', err);
  }
}
