import { Request, Response } from 'express';
import { IAuthenticatedRequest } from '../middlewares/auth.middleware';
import { generate as ragGenerate } from '../services/rag.service';

export async function generate(req: Request, res: Response): Promise<void> {
  try {
    const { user } = req as IAuthenticatedRequest;
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const result = await ragGenerate(user.id, prompt.trim());

    res.json(result);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({
      error: 'Failed to generate content',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
