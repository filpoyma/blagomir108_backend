import type { CommandContext } from 'grammy';
import { upsertTelegramUser } from '../../services/telegram-users.service';
import { config } from '../../config';
import type { IBotContext } from '../types';

const WELCOME_LINES = [
  'Привет! Я генерирую маркетинговый контент по запросу — текст, image-prompt и video-prompt.',
  '',
  'Просто напишите тему или ТЗ — например: <i>«Пост в Instagram про новую коллекцию весна 2026, акцент на эко-материалы»</i>.',
  '',
  `Стартовый баланс: <b>${config.telegram.freeQuota}</b> запросов. Когда баланс закончится — напишите владельцу для пополнения.`,
];

const HELP_LINES = [
  '<b>Как пользоваться</b>',
  'Отправьте текстовое описание задачи. В ответ придут три блока:',
  '• <b>Текст</b> — готовый маркетинговый текст;',
  '• <b>Image prompt</b> — промпт для генератора изображений;',
  '• <b>Video prompt</b> — промпт для генератора видео.',
  '',
  '<b>Команды</b>',
  '/start — показать приветствие;',
  '/help — это сообщение.',
];

export async function handleStart(ctx: CommandContext<IBotContext>): Promise<void> {
  const user = ctx.from;
  const chat = ctx.chat;
  if (!user || !chat) return;

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
}

export async function handleHelp(ctx: CommandContext<IBotContext>): Promise<void> {
  await ctx.reply(HELP_LINES.join('\n'), { parse_mode: 'HTML' });
}
