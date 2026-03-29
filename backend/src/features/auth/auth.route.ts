import { Router } from 'express';
import { authenticate } from './auth.controller';

const router = Router();

router.post('/', authenticate);

export default router;
