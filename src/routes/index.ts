import { Router } from 'express';
import { documentsRouter } from './documents.routes';
import { generateRouter } from './generate.routes';
import { authMiddleware } from '../middlewares/auth.middleware';

export const router = Router();

router.use('/documents', authMiddleware, documentsRouter);
router.use('/generate', authMiddleware, generateRouter);
