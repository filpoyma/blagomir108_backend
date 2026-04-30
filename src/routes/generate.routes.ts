import { Router } from 'express';
import { generate } from '../controllers/generate.controller';

export const generateRouter = Router();

generateRouter.post('/', generate);
