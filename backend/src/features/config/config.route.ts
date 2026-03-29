import { Router } from 'express';
import { getConfig } from './config.controller';

const router = Router();

router.get('/', getConfig);

export default router;
