import type { Filter } from 'grammy';
import { setTelegramUserLastSphere } from '../../services/telegram-users.service';
import { clearHealthWizard, startHealthSurvey } from '../flows/health-survey.wizard';
import {
  SPHERE_CALLBACK,
  SPHERE_LABEL_BY_CALLBACK,
  sphereKeyFromCallback,
} from '../keyboards/sphere.keyboard';
import type { IBotContext } from '../types';

export async function handleSphereChoice(
  ctx: Filter<IBotContext, 'callback_query:data'>
): Promise<void> {
  const user = ctx.from;
  const data = ctx.callbackQuery.data;
  const label = SPHERE_LABEL_BY_CALLBACK[data];

  if (user && data !== SPHERE_CALLBACK.health) {
    clearHealthWizard(user.id);
  }

  if (!label) {
    await ctx.answerCallbackQuery({ text: 'Неизвестный вариант' });
    return;
  }

  const sphereKey = sphereKeyFromCallback(data);
  if (user && sphereKey) {
    try {
      await setTelegramUserLastSphere(user.id, sphereKey);
    } catch (err) {
      console.error('[bot] setTelegramUserLastSphere failed:', err);
    }
  }

  if (data === SPHERE_CALLBACK.health) {
    await ctx.answerCallbackQuery();
    await startHealthSurvey(ctx);
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `Выбрана сфера: <b>${label}</b>\n\nОпишите текстом, что для вас сейчас важно в этой теме.`,
    { parse_mode: 'HTML' }
  );
}
