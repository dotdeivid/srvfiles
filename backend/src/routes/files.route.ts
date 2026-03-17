import { Router } from 'express';
import upload from '../middleware/upload';
import * as filesController from '../controllers/files.controller';
import { MAX_UPLOAD_COUNT } from '../config';

const router = Router();

/**
 * File routes — thin layer that maps HTTP verbs to controller functions.
 * All business logic lives in controllers/ and services/.
 */

router.post('/upload', upload.array('files', MAX_UPLOAD_COUNT), filesController.uploadFiles);
router.get('/', filesController.listFiles);
router.get('/download/:filename', filesController.downloadFile);
router.get('/stats', filesController.getStats);
router.delete('/:filename', filesController.deleteFile);

export default router;
