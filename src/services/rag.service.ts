import { config } from '../config';
import { supabaseAdmin } from '../config/supabase';
import { generateEmbedding } from './embedding.service';
import { generateCompletion } from './llm.service';

interface IGenerateResult {
  text: string;
  image_prompt: string;
  video_prompt: string;
}

interface IDocumentMatch {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

const SYSTEM_PROMPT_TEMPLATE = `You are an AI marketing content generator for a business.
Your job is to create high-quality marketing content based on the user's knowledge base and their request.

Context from the knowledge base:
{context}

IMPORTANT: You must respond with valid JSON in exactly this format:
{
  "text": "The generated marketing text content",
  "image_prompt": "A detailed prompt for generating a marketing image",
  "video_prompt": "A detailed prompt for generating a marketing video"
}

Respond ONLY with the JSON object. No markdown, no explanation, no extra text.`;

export async function generate(
  userId: string,
  prompt: string
): Promise<IGenerateResult> {
  const queryEmbedding = await generateEmbedding(prompt);

  const relevantDocs = await vectorSearch(userId, queryEmbedding);

  const context = relevantDocs.length > 0
    ? relevantDocs.map((doc, i) => `[${i + 1}] ${doc.content}`).join('\n\n')
    : 'No relevant context found in the knowledge base.';

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{context}', context);

  const rawResponse = await generateCompletion(systemPrompt, prompt);

  return parseResponse(rawResponse);
}

async function vectorSearch(
  userId: string,
  queryEmbedding: number[],
  limit = 5
): Promise<IDocumentMatch[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await supabaseAdmin.rpc('match_documents', {
    query_embedding: embeddingStr,
    match_threshold: config.rag.matchThreshold,
    match_count: limit,
    p_user_id: userId,
  });

  if (error) {
    console.error('Vector search RPC failed, falling back to raw query:', error.message);
    return vectorSearchFallback(userId, queryEmbedding, limit);
  }

  return (data || []) as IDocumentMatch[];
}

async function vectorSearchFallback(
  userId: string,
  queryEmbedding: number[],
  limit: number
): Promise<IDocumentMatch[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, content, metadata')
    .eq('user_id', userId)
    .limit(limit);

  if (error) {
    throw new Error(`Document query failed: ${error.message}`);
  }

  // If RPC is not available, fall back to basic retrieval
  // The RPC function provides proper vector similarity search
  return (data || []).map((doc) => ({
    ...doc,
    similarity: 0,
  }));
}

function parseResponse(raw: string): IGenerateResult {
  const cleaned = raw
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      text: parsed.text || '',
      image_prompt: parsed.image_prompt || '',
      video_prompt: parsed.video_prompt || '',
    };
  } catch {
    return {
      text: raw,
      image_prompt: '',
      video_prompt: '',
    };
  }
}
