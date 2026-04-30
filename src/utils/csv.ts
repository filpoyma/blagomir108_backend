import Papa from 'papaparse';
import { chunkText } from './chunker';

export interface ICsvChunk {
  content: string;
  rowIndex: number;
  chunkInRowIndex?: number;
  totalChunksInRow?: number;
}

export interface ICsvParseResult {
  columns: string[];
  rowCount: number;
  chunks: ICsvChunk[];
}

// Empirical: text-embedding-3-small accepts ~8k tokens (~30k chars). We use a
// conservative ceiling so a single CSV row stays below it; longer rows fall
// back to recursive chunking and keep their row_index.
const ROW_CHUNK_THRESHOLD = 4000;

type TCsvRow = Record<string, string | undefined>;

export function parseCsvToChunks(csv: string): ICsvParseResult {
  const parsed = Papa.parse<TCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const columns = parsed.meta.fields ?? [];
  const rows = parsed.data;
  const chunks: ICsvChunk[] = [];

  rows.forEach((row, rowIndex) => {
    const formatted = formatRow(row, columns);
    if (!formatted) return;

    if (formatted.length <= ROW_CHUNK_THRESHOLD) {
      chunks.push({ content: formatted, rowIndex });
      return;
    }

    const subChunks = chunkText(formatted);
    subChunks.forEach((content, chunkInRowIndex) => {
      chunks.push({
        content,
        rowIndex,
        chunkInRowIndex,
        totalChunksInRow: subChunks.length,
      });
    });
  });

  return {
    columns,
    rowCount: rows.length,
    chunks,
  };
}

function formatRow(row: TCsvRow, columns: string[]): string {
  const parts: string[] = [];
  for (const col of columns) {
    const raw = row[col];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim().replace(/\s+/g, ' ');
    if (!value) continue;
    parts.push(`${col}: ${value}`);
  }
  return parts.join('; ');
}
