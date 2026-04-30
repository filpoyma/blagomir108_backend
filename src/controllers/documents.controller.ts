import { Request, Response } from 'express';
import { IAuthenticatedRequest } from '../middlewares/auth.middleware';
import { supabaseAdmin } from '../config/supabase';
import { generateEmbeddings } from '../services/embedding.service';
import { chunkText } from '../utils/chunker';
import { parseCsvToChunks } from '../utils/csv';

interface IPreparedChunk {
  content: string;
  metadata: Record<string, unknown>;
}

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { user } = req as IAuthenticatedRequest;
    const items = collectChunks(req);

    if (items === null) {
      res.status(400).json({ error: 'No content provided. Send content in body or upload a file.' });
      return;
    }

    if (items.length === 0) {
      res.status(400).json({ error: 'Content is empty or has no parseable rows' });
      return;
    }

    const embeddings = await generateEmbeddings(items.map((it) => it.content));

    const records = items.map((it, i) => ({
      user_id: user.id,
      content: it.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: it.metadata,
    }));

    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert(records)
      .select('id, content, metadata, created_at');

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
    
    res.status(201).json({
      message: `Uploaded ${items.length} chunk(s)`,
      documents: data,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({
      error: 'Failed to upload document',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

function collectChunks(req: Request): IPreparedChunk[] | null {
  if (req.file) {
    const fileContent = req.file.buffer.toString('utf-8');
    const isCsv =
      req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');

    if (isCsv) return prepareCsvChunks(fileContent, req.file.originalname);
    
    return prepareTextChunks(fileContent, {
      source: 'file',
      filename: req.file.originalname,
    });
  }

  if (typeof req.body?.content === 'string' && req.body.content.length > 0) {
    return prepareTextChunks(req.body.content, {
      source: typeof req.body.type === 'string' ? req.body.type : 'text',
    });
  }

  return null;
}

function prepareCsvChunks(csv: string, filename: string): IPreparedChunk[] {
  const result = parseCsvToChunks(csv);
  const base = {
    source: 'csv' as const,
    filename,
    columns: result.columns,
    row_count: result.rowCount,
  };

  return result.chunks.map((chunk, i) => ({
    content: chunk.content,
    metadata: {
      ...base,
      chunk_index: i,
      total_chunks: result.chunks.length,
      row_index: chunk.rowIndex,
      ...(chunk.chunkInRowIndex !== undefined
        ? {
            chunk_in_row_index: chunk.chunkInRowIndex,
            total_chunks_in_row: chunk.totalChunksInRow,
          }
        : {}),
    },
  }));
}

function prepareTextChunks(
  content: string,
  base: Record<string, unknown>
): IPreparedChunk[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const chunks = chunkText(trimmed);
  return chunks.map((chunk, i) => ({
    content: chunk,
    metadata: { ...base, chunk_index: i, total_chunks: chunks.length },
  }));
}

export async function getDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { user } = req as IAuthenticatedRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('documents')
      .select('id, content, metadata, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    res.json({
      documents: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  try {
    const { user } = req as IAuthenticatedRequest;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({
      error: 'Failed to delete document',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
