import { config } from '../config';

interface IEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [result] = await generateEmbeddings([text]);
  return result;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${config.embedding.apiUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.embedding.apiKey}`,
    },
    body: JSON.stringify({
      model: config.embedding.model,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let hint = '';
    if (response.status === 404) {
      hint =
        ' Hint: On OpenRouter, use a model slug from https://openrouter.ai/models?output_modalities=embeddings (e.g. openai/text-embedding-3-small). Chat-only or unsupported model IDs return 404.';
    }
    throw new Error(`Embedding API error (${response.status}): ${errorBody}${hint}`);
  }

  const data = (await response.json()) as IEmbeddingResponse;

  return data.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
