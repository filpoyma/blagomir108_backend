import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { router } from './routes';
import {
  configureWebhook,
  createBot,
  startBotPolling,
  stopBot,
  type TBot,
} from './bot';
import { createTelegramRouter } from './routes/telegram.routes';

const app = express();
const port = config.port;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

let bot: TBot | null = null;
if (config.telegram.enabled) {
  bot = createBot();
  // Mount webhook route only in webhook mode. webhookCallback() marks the bot as
  // webhook-driven in grammy; combining it with bot.start() (polling) throws.
  if (config.telegram.mode === 'webhook') {
    // Mounted BEFORE the JWT-protected /api router so authMiddleware does not
    // interfere; auth is enforced via secret_token inside webhookCallback.
    app.use('/api/telegram', createTelegramRouter(bot, config.telegram.webhookSecret));
  }
}

app.use('/api', router);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
);

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);

  if (bot && config.telegram.enabled) {
    if (config.telegram.mode === 'webhook') {
      configureWebhook(bot).catch((err) => {
        console.error('[bot] failed to configure webhook:', err);
      });
    } else {
      startBotPolling(bot).catch((err) => {
        console.error('[bot] long polling stopped with error:', err);
      });
    }
  }
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  if (bot) {
    await stopBot(bot);
  }

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
