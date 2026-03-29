import { Router } from 'express';
import { scan } from './discovery.controller';

const router = Router();

router.get('/scan', scan);

export default router;
