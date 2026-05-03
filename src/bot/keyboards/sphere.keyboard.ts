import { InlineKeyboard } from 'grammy';

export const SPHERE_CALLBACK = {
  health: 'sphere_health',
  relations: 'sphere_relations',
  money: 'sphere_money',
  soul: 'sphere_soul',
  jyotish: 'sphere_jyotish',
} as const;

export const SPHERE_LABEL_BY_CALLBACK: Record<string, string> = {
  [SPHERE_CALLBACK.health]: 'здоровье',
  [SPHERE_CALLBACK.relations]: 'отношения',
  [SPHERE_CALLBACK.money]: 'деньги, карьера, реализация',
  [SPHERE_CALLBACK.soul]: 'предназначение души',
  [SPHERE_CALLBACK.jyotish]: 'разборы Джойтиш',
};

/** Stable slug stored in DB column `telegram_users.last_sphere`. */
export type TTelegramSphereKey = keyof typeof SPHERE_CALLBACK;

const SPHERE_KEY_BY_CALLBACK: Record<string, TTelegramSphereKey> = {
  [SPHERE_CALLBACK.health]: 'health',
  [SPHERE_CALLBACK.relations]: 'relations',
  [SPHERE_CALLBACK.money]: 'money',
  [SPHERE_CALLBACK.soul]: 'soul',
  [SPHERE_CALLBACK.jyotish]: 'jyotish',
};

export function sphereKeyFromCallback(callbackData: string): TTelegramSphereKey | null {
  const key = SPHERE_KEY_BY_CALLBACK[callbackData];
  return key ?? null;
}

export function buildSphereChoiceKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('здоровье', SPHERE_CALLBACK.health)
    .row()
    .text('отношения', SPHERE_CALLBACK.relations)
    .row()
    .text('деньги, карьера, реализация', SPHERE_CALLBACK.money)
    .row()
    .text('предназначение души', SPHERE_CALLBACK.soul)
    .row()
    .text('разборы Джойтиш', SPHERE_CALLBACK.jyotish);
}
