import type { Filter } from 'grammy';
import { config } from '../../config';
import { generate as ragGenerate } from '../../services/rag.service';
import { consumeQuota, getQuota } from '../../services/telegram-users.service';
import { handleHealthSurveyText } from '../flows/health-survey.wizard';
import { formatGenerateResult } from '../format/response.format';
import type { IBotContext } from '../types';
import { isUnlimitedTelegramUser } from '../utils/unlimited';

const MAX_PROMPT_LENGTH = 4000;

export async function handleTextGenerate(
  ctx: Filter<IBotContext, 'message:text'>
): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message.text.trim();
  if (!text) {
    await ctx.reply('Пустое сообщение. Опишите задачу текстом.');
    return;
  }

  if (await handleHealthSurveyText(ctx)) {
    return;
  }

  if (text.length > MAX_PROMPT_LENGTH) {
    await ctx.reply(`Слишком длинное сообщение (${text.length} симв.). Лимит: ${MAX_PROMPT_LENGTH}.`);
    return;
  }

  const quotaExempt = isUnlimitedTelegramUser(user.id);

  const quota = await getQuota(user.id);
  if (!quota) {
    await ctx.reply('Сначала отправьте команду /start, чтобы создать профиль.');
    return;
  }
  if (!quotaExempt && quota.remaining <= 0) {
    await ctx.reply(
      'Ваш баланс запросов исчерпан. Свяжитесь с владельцем бота для пополнения.'
    );
    return;
  }

  await ctx.replyWithChatAction('typing').catch(() => undefined);

  let result;
  try {
    result = await ragGenerate(config.telegram.ownerUserId, text);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`[bot] ${ctx.state.requestId} ragGenerate failed:`, message);
    await ctx.reply('Не удалось сгенерировать ответ. Попробуйте позже.');
    return;
  }

  let consumed = false;
  if (!quotaExempt) {
    consumed = await consumeQuota(user.id);
    if (!consumed) {
      console.warn(
        `[bot] ${ctx.state.requestId} consumeQuota race: quota was exhausted between pre-check and post-consume for user=${user.id}`
      );
    }
  }

  const messages = formatGenerateResult(result);
  for (const message of messages) {
    await ctx.reply(message, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  }

  if (!quotaExempt) {
    const remainingAfter = consumed ? Math.max(0, quota.remaining - 1) : quota.remaining;
    if (remainingAfter <= 1) {
      const tail = remainingAfter === 0
        ? 'Это был ваш последний бесплатный запрос. Свяжитесь с владельцем для пополнения.'
        : 'Остался 1 запрос на балансе.';
      await ctx.reply(tail);
    }
  }
}
