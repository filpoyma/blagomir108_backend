import type { Filter } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { setTelegramUserHealthFacts } from '../../services/telegram-users.service';
import type { IBotContext } from '../types';

const HEALTH_INTRO = `Сфера «здоровье» — небольшая анкета из 4 шагов. Я буду присылать по одному вопросу; ответы сохраню в твой профиль, чтобы дальше опираться на них в диалоге.

Что разберём по шагам:
1) Что тебя сейчас беспокоит — одним сообщением, чем подробнее, тем лучше.
2) Как давно это есть и когда становится хуже — можно нажать подсказку или написать своими словами.
3) Насколько это мешает — шкала от 1 до 10.
4) Какой результат хочешь.

После анкеты просто пиши вопросы по здоровью в свободной форме.`;

const STEP1_CTA =
  '<b>Шаг 1 из 4.</b>\nНапиши <b>одним сообщением</b>, что тебя сейчас беспокоит (максимально подробно).';

type THealthStep =
  | 'wait_bothering'
  | 'wait_when'
  | 'wait_severity'
  | 'wait_goal';

interface IHealthDraft {
  step: THealthStep;
  bothering?: string;
  whenWorse?: string;
  severity?: number;
  desiredResult?: string;
}

const wizardByUser = new Map<number, IHealthDraft>();

export function clearHealthWizard(telegramId: number): void {
  wizardByUser.delete(telegramId);
}

/** Call when user chose «здоровье» — starts multi-step survey. */
export async function startHealthSurvey(ctx: IBotContext): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  wizardByUser.set(user.id, { step: 'wait_bothering' });

  await ctx.reply(HEALTH_INTRO);
  await ctx.reply(STEP1_CTA, { parse_mode: 'HTML' });
}

function whenKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('после еды', 'health_when_after_food')
    .text('вечером', 'health_when_evening')
    .row()
    .text('при стрессе', 'health_when_stress')
    .text('случайно', 'health_when_random');
}

function severityKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 1; i <= 5; i++) {
    kb.text(String(i), `health_sev_${i}`);
  }
  kb.row();
  for (let i = 6; i <= 10; i++) {
    kb.text(String(i), `health_sev_${i}`);
  }
  return kb;
}

function goalKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('убрать симптомы', 'health_goal_symptoms')
    .row()
    .text('понять причину', 'health_goal_cause')
    .row()
    .text('улучшить общее состояние', 'health_goal_state');
}

const WHEN_LABEL: Record<string, string> = {
  health_when_after_food: 'после еды',
  health_when_evening: 'вечером',
  health_when_stress: 'при стрессе',
  health_when_random: 'случайно',
};

const GOAL_LABEL: Record<string, string> = {
  health_goal_symptoms: 'убрать симптомы',
  health_goal_cause: 'понять причину',
  health_goal_state: 'улучшить общее состояние',
};

async function sendStepWhen(ctx: IBotContext): Promise<void> {
  await ctx.reply(
    '<b>Шаг 2 из 4.</b>\nКак давно это началось и когда становится хуже?\n\n' +
      'Нажми кнопку-подсказку или напиши своими словами одним сообщением.',
    { parse_mode: 'HTML', reply_markup: whenKeyboard() }
  );
}

async function sendStepSeverity(ctx: IBotContext): Promise<void> {
  await ctx.reply(
    '<b>Шаг 3 из 4.</b>\nНасколько это мешает тебе по шкале от <b>1</b> до <b>10</b>?\n\n' +
      'Нажми цифру или отправь число сообщением.',
    { parse_mode: 'HTML', reply_markup: severityKeyboard() }
  );
}

async function sendStepGoal(ctx: IBotContext): Promise<void> {
  await ctx.reply('<b>Шаг 4 из 4.</b>\nКакой результат ты хочешь получить?', {
    parse_mode: 'HTML',
    reply_markup: goalKeyboard(),
  });
}

async function finishSurvey(ctx: IBotContext, draft: IHealthDraft): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  const { bothering, whenWorse, severity, desiredResult } = draft;
  if (
    bothering === undefined ||
    whenWorse === undefined ||
    severity === undefined ||
    desiredResult === undefined
  ) {
    await ctx.reply('Не хватает данных анкеты. Начни снова: /start');
    wizardByUser.delete(user.id);
    return;
  }

  const completedAt = new Date().toISOString();
  await setTelegramUserHealthFacts(user.id, {
    bothering,
    whenWorse,
    severity,
    desiredResult,
    completedAt,
  });

  wizardByUser.delete(user.id);

  await ctx.reply(
    'Спасибо! Анкета сохранена в твоём профиле.\n\nТеперь можешь писать вопросы по здоровью — я опираюсь на базу знаний.',
    { parse_mode: 'HTML' }
  );
}

export async function handleHealthSurveyText(
  ctx: Filter<IBotContext, 'message:text'>
): Promise<boolean> {
  const user = ctx.from;
  if (!user) return false;

  const draft = wizardByUser.get(user.id);
  if (!draft) return false;

  const text = ctx.message.text.trim();
  if (!text) {
    await ctx.reply('Нужен непустой ответ.');
    return true;
  }

  if (draft.step === 'wait_bothering') {
    draft.bothering = text;
    draft.step = 'wait_when';
    await sendStepWhen(ctx);
    return true;
  }

  if (draft.step === 'wait_when') {
    draft.whenWorse = text;
    draft.step = 'wait_severity';
    await sendStepSeverity(ctx);
    return true;
  }

  if (draft.step === 'wait_severity') {
    const n = Number.parseInt(text, 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      await ctx.reply('Отправь число от 1 до 10 или нажми кнопку.');
      return true;
    }
    draft.severity = n;
    draft.step = 'wait_goal';
    await sendStepGoal(ctx);
    return true;
  }

  if (draft.step === 'wait_goal') {
    await ctx.reply('Выбери один из вариантов кнопкой под предыдущим сообщением.');
    return true;
  }

  return false;
}

export async function handleHealthSurveyCallback(
  ctx: Filter<IBotContext, 'callback_query:data'>
): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const data = ctx.callbackQuery.data;
  const draft = wizardByUser.get(user.id);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: 'Анкета не активна. Нажми /start → здоровье.' });
    return;
  }

  if (data.startsWith('health_when_')) {
    if (draft.step !== 'wait_when') {
      await ctx.answerCallbackQuery({ text: 'Сначала ответь на предыдущий шаг текстом.' });
      return;
    }
    const label = WHEN_LABEL[data];
    if (!label) {
      await ctx.answerCallbackQuery({ text: 'Неизвестный вариант' });
      return;
    }
    draft.whenWorse = label;
    draft.step = 'wait_severity';
    await ctx.answerCallbackQuery();
    await sendStepSeverity(ctx);
    return;
  }

  const sevMatch = /^health_sev_(\d+)$/.exec(data);
  if (sevMatch) {
    if (draft.step !== 'wait_severity') {
      await ctx.answerCallbackQuery({ text: 'Сейчас другой шаг анкеты.' });
      return;
    }
    const n = Number.parseInt(sevMatch[1], 10);
    if (n < 1 || n > 10) {
      await ctx.answerCallbackQuery({ text: 'Некорректное значение' });
      return;
    }
    draft.severity = n;
    draft.step = 'wait_goal';
    await ctx.answerCallbackQuery();
    await sendStepGoal(ctx);
    return;
  }

  if (data.startsWith('health_goal_')) {
    if (draft.step !== 'wait_goal') {
      await ctx.answerCallbackQuery({ text: 'Сейчас другой шаг анкеты.' });
      return;
    }
    const label = GOAL_LABEL[data];
    if (!label) {
      await ctx.answerCallbackQuery({ text: 'Неизвестный вариант' });
      return;
    }
    draft.desiredResult = label;
    await ctx.answerCallbackQuery();
    await finishSurvey(ctx, draft);
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Неизвестное действие' });
}
