import type { MiddlewareFn } from 'grammy';
import type { IBotContext } from '../types';

let counter = 0;

function nextRequestId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `tg-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export const loggingMiddleware: MiddlewareFn<IBotContext> = async (ctx, next) => {
  const requestId = nextRequestId();
  const startedAt = Date.now();
  ctx.state = { requestId, startedAt };

  const updateKind = ctx.message?.text
    ? 'text'
    : ctx.message
      ? 'message'
      : ctx.update
        ? Object.keys(ctx.update).filter((k) => k !== 'update_id')[0] ?? 'unknown'
        : 'unknown';
  const userId = ctx.from?.id ?? 'anonymous';

  console.log(`[bot] ${requestId} -> from=${userId} kind=${updateKind}`);

  try {
    await next();
    const elapsed = Date.now() - startedAt;
    console.log(`[bot] ${requestId} <- ok (${elapsed}ms)`);
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`[bot] ${requestId} <- error (${elapsed}ms):`, message);
    throw err;
  }
};
