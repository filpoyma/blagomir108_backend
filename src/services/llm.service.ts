import { config } from '../config';

interface IChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface IChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = [1000, 2500];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const messages: IChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openRouter.apiKey}`,
      },
      body: JSON.stringify({
        model: config.openRouter.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
      await response.text();
      await delay(RATE_LIMIT_BACKOFF_MS[attempt] ?? 3000);
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      let hint = '';
      if (response.status === 429) {
        hint =
          ' Free tier models are often rate-limited upstream. Options: retry later, set LLM_MODEL to a paid (non-:free) model, add provider API key under OpenRouter Integrations, or add OpenRouter credits.';
      }
      throw new Error(`LLM API error (${response.status}): ${errorBody}${hint}`);
    }

    const data = (await response.json()) as IChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  }

  throw new Error('LLM request failed after rate-limit retries');
}
