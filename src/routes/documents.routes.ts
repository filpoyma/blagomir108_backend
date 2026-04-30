import { Router } from 'express';
import multer from 'multer';
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
} from '../controllers/documents.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const documentsRouter = Router();

documentsRouter.post('/', upload.single('file'), uploadDocument);
documentsRouter.get('/', getDocuments);
documentsRouter.delete('/:id', deleteDocument);
