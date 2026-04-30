interface IGenerateResultLike {
  text: string;
  image_prompt: string;
  video_prompt: string;
}

const TELEGRAM_MESSAGE_LIMIT = 4096;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build HTML messages for Telegram (parse_mode: 'HTML').
// Splits into multiple messages if total length exceeds TELEGRAM_MESSAGE_LIMIT,
// preferring section boundaries first, then paragraph boundaries.
export function formatGenerateResult(result: IGenerateResultLike): string[] {
  const sections: string[] = [];

  if (result.text.trim()) {
    sections.push(`<b>Текст</b>\n${escapeHtml(result.text.trim())}`);
  }
  if (result.image_prompt.trim()) {
    sections.push(`<b>Image prompt</b>\n<code>${escapeHtml(result.image_prompt.trim())}</code>`);
  }
  if (result.video_prompt.trim()) {
    sections.push(`<b>Video prompt</b>\n<code>${escapeHtml(result.video_prompt.trim())}</code>`);
  }

  if (sections.length === 0) {
    return ['<i>Пустой результат генерации</i>'];
  }

  return packIntoMessages(sections);
}

function packIntoMessages(sections: string[]): string[] {
  const messages: string[] = [];
  let buffer = '';

  for (const section of sections) {
    const candidate = buffer ? `${buffer}\n\n${section}` : section;
    if (candidate.length <= TELEGRAM_MESSAGE_LIMIT) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      messages.push(buffer);
      buffer = '';
    }

    if (section.length <= TELEGRAM_MESSAGE_LIMIT) {
      buffer = section;
    } else {
      messages.push(...splitOversized(section));
      buffer = '';
    }
  }

  if (buffer) {
    messages.push(buffer);
  }

  return messages;
}

function splitOversized(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let buffer = '';

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= TELEGRAM_MESSAGE_LIMIT) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = '';
    }

    if (paragraph.length <= TELEGRAM_MESSAGE_LIMIT) {
      buffer = paragraph;
    } else {
      for (let i = 0; i < paragraph.length; i += TELEGRAM_MESSAGE_LIMIT) {
        chunks.push(paragraph.slice(i, i + TELEGRAM_MESSAGE_LIMIT));
      }
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}
