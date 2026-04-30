interface IChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}

const DEFAULT_OPTIONS: IChunkOptions = {
  chunkSize: 1600,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
};

export function chunkText(
  text: string,
  options: Partial<IChunkOptions> = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, separators } = opts;

  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }

  return splitRecursively(text, separators, chunkSize, chunkOverlap);
}

function splitRecursively(
  text: string,
  separators: string[],
  chunkSize: number,
  chunkOverlap: number
): string[] {
  if (!text.trim()) return [];

  const separator = findBestSeparator(text, separators);

  const parts = separator === ''
    ? text.split('')
    : text.split(separator);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const part of parts) {
    const piece = separator === '' ? part : part + separator;

    if ((currentChunk + piece).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
      currentChunk = currentChunk.slice(overlapStart) + piece;
    } else {
      currentChunk += piece;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(Boolean);
}

function findBestSeparator(text: string, separators: string[]): string {
  for (const sep of separators) {
    if (sep === '' || text.includes(sep)) {
      return sep;
    }
  }
  return '';
}
