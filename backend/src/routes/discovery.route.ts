import { Router } from 'express';
import { scan } from '../controllers/discovery.controller';

const router = Router();

router.get('/scan', scan);

export default router;
