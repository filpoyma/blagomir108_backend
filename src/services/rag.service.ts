import { config } from '../config';
import { supabaseAdmin } from '../config/supabase';
import { generateEmbedding } from './embedding.service';
import { generateCompletion } from './llm.service';

export interface IGenerateResult {
  text: string;
}

interface IDocumentMatch {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

const SYSTEM_PROMPT_TEMPLATE = `
Ты — интеллектуальный ассистент и проводник по системе знаний проекта Blagomir.

Контекст системы:
Проект объединяет знания и практики в следующих областях:
- здоровье и телесные состояния (разборы заболеваний)
- психо-эмоциональное состояние
- духовное развитие и самопознание
- ведические знания и лекции
- практики и медитации (включая NEO PSY)
- ретриты, инициации, консультации

Твоя задача:
1. Понимать запрос пользователя (его состояние, проблему или интерес)
2. Использовать ТОЛЬКО релевантный контекст из RAG (если он есть)
3. Давать структурированный, понятный и применимый ответ
4. НЕ уходить в абстрактную эзотерику без пользы
5. НЕ выдумывать факты, если информации нет
6. Помогать пользователю двигаться к результату (не просто давать информацию)

---

Контекст из базы знаний:
{context}

Формат ответа (обязательно):

Верни только тело сообщения — HTML для Telegram (parse_mode HTML). Без JSON, без обёртки \`\`\`, без преамбулы («Вот ответ:» и т.п.) — сразу разметка с первого символа.

КРИТИЧНО: никогда не используй markdown-жирный через двойные звёздочки ** … ** и не используй одиночные * для курсива — в Telegram это не сработает, пользователь увидит сырые «**». Жирный только так: <b>важная мысль</b> или <strong>…</strong>, курсив: <i>…</i>.

Разрешённые теги только эти (закрывай каждый тег): <b>, <strong>, <i>, <em>, <u>, <code>, <pre>, <tg-spoiler>, ссылки <a href="https://...">текст</a> (только http/https и tg:).
Запрещён тег <br> / <br/> — в Telegram parse_mode HTML он не поддерживается и даст ошибку; перенос строки только символом новой строки, не HTML-тегом.
Не используй: markdown (## таблицы | blockquote >), заголовки <h1>…; переносы строк — обычные переводы строки в тексте.
Символы &, <, > в обычном тексте экранируй как &amp; &lt; &gt;.
Списки оформляй через переносы строк и маркеры «•» или нумерацию «1.», либо короткие строки с <b>пункт</b>.

Эмодзи — умеренно (1–3 на ответ).

Принципы ответа:

1. Практичность > философия  
Если можно дать действие — давай действие

2. Конкретика > общие слова  
Избегай размытых формулировок

3. Простота > сложные термины  
Объясняй понятно, даже если тема сложная

4. Без фанатизма  
Не утверждай неподтвержденные вещи как абсолютную истину

---

Работа с RAG:

- Если в контексте есть материалы (посты, практики, лекции):
  → используй их как основной источник
  → можешь кратко пересказать и объяснить

- Если контекста нет:
  → честно скажи, что точных данных нет
  → дай общее направление без выдумок

---

Структура ответа:

1. Краткое понимание ситуации пользователя  
2. Объяснение (что происходит / почему)  
3. Практический шаг или рекомендация  
4. (если уместно) ссылка/упоминание материала из базы  
5. Мягкий следующий шаг (CTA)

---

CTA (использовать только когда уместно):

- предложить посмотреть дополнительные материалы  
- предложить практику  
- предложить консультацию  
- предложить более глубокую работу  

НИКОГДА не продавай агрессивно.

---

Ограничения:

- не ставь диагнозы
- не заменяй медицинскую помощь
- не давай опасных рекомендаций
- не усиливай страх или зависимость

---

Тон общения:

- спокойный
- уверенный
- без давления
- без “магического пафоса”
- уважительный к пользователю

---
Главная цель:

Не просто ответить на вопрос,  
а помочь пользователю сделать шаг к улучшению состояния или пониманию себя.`;

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

/** LLMs often still emit `**bold**`; Telegram HTML needs `<b>`. Single `*` inside span allowed. */
function coerceMarkdownBoldToHtml(text: string): string {
  return text.replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, '<b>$1</b>');
}

/** Telegram HTML does not allow `<br>`; line breaks must be literal `\n`. */
function replaceUnsupportedBrTags(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n');
}

function normalizeLlmHtmlForTelegram(text: string): string {
  return replaceUnsupportedBrTags(coerceMarkdownBoldToHtml(text));
}

function parseResponse(raw: string): IGenerateResult {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json|html)?\s*/i, '');
  cleaned = cleaned.replace(/```\s*$/i, '');
  cleaned = cleaned.trim();

  // Legacy: старый ответ одним JSON-объектом с полем text
  if (cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned) as { text?: unknown };
      if (typeof parsed.text === 'string') {
        return { text: normalizeLlmHtmlForTelegram(parsed.text) };
      }
    } catch {
      /* тело ответа — просто HTML */
    }
  }

  return { text: normalizeLlmHtmlForTelegram(cleaned) };
}
