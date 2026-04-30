import type { Context } from 'grammy';

export interface IBotState {
  requestId: string;
  startedAt: number;
}

export interface IBotContext extends Context {
  state: IBotState;
}
