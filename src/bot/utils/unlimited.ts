import { config } from '../../config';

export function isUnlimitedTelegramUser(telegramId: number): boolean {
  return config.telegram.unlimitedTelegramIds.includes(telegramId);
}
