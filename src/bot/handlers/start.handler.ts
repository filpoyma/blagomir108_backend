import type { CommandContext } from 'grammy';
import { upsertTelegramUser } from '../../services/telegram-users.service';
import { config } from '../../config';
import { clearHealthWizard } from '../flows/health-survey.wizard';
import { buildSphereChoiceKeyboard } from '../keyboards/sphere.keyboard';
import type { IBotContext } from '../types';

const SPHERE_PROMPT = 'Какая сфера для тебя наиболее актуальна?';

const WELCOME_LINES = [
  `🕉 Мое почтение
      Добро пожаловать в пространство знаний и трансформации

  Этот бот — ваш проводник по системе:
    — самопознания
    — работы с телом и психикой
    — ведических знаний
    — глубинных практик и медитаций

📚 Здесь собраны материалы из канала:
    • медитации и практики (NEO PSY ⚡)
    • разборы заболеваний и состояний
    • вед`,
  '',
  `Стартовый баланс: <b>${config.telegram.freeQuota}</b> запросов. Когда баланс закончится — напишите владельцу для пополнения.`,
];

const HELP_LINES = [
  '<b>Как пользоваться</b>',
  'Выберете интересующую вас сферу',
  '• <b>здоровье</b>',
  '• <b>отношения</b>',
  '• <b>деньги, карьера, реализация</b>',
  '• <b>предназначение души</b>',
  '• <b>разборы Джойтиш</b>',
  '',
  'Следуйте инструкциям',
  '',
  '<b>Команды</b>',
  '/start — запуск помошника;',
  '/help — это сообщение.',
];

export async function handleStart(ctx: CommandContext<IBotContext>): Promise<void> {
  const user = ctx.from;
  const chat = ctx.chat;
  if (!user || !chat) return;

  clearHealthWizard(user.id);

  await upsertTelegramUser({
    telegramId: user.id,
    chatId: chat.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    languageCode: user.language_code,
    isBot: user.is_bot,
    isPremium: user.is_premium,
  });

  await ctx.reply(WELCOME_LINES.join('\n'), { parse_mode: 'HTML' });

  await ctx.reply(SPHERE_PROMPT, {
    parse_mode: 'HTML',
    reply_markup: buildSphereChoiceKeyboard(),
  });
}

export async function handleHelp(ctx: CommandContext<IBotContext>): Promise<void> {
  await ctx.reply(HELP_LINES.join('\n'), { parse_mode: 'HTML' });
}
