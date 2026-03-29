import { Router } from 'express';
import upload from './upload.middleware';
import * as filesController from './files.controller';
import { MAX_UPLOAD_COUNT } from '../../config';

const router = Router();

/**
 * File routes — thin layer that maps HTTP verbs to controller functions.
 */

router.post('/upload', upload.array('files', MAX_UPLOAD_COUNT), filesController.uploadFiles);
router.get('/', filesController.listFiles);
router.get('/download/:filename', filesController.downloadFile);
router.get('/preview/:filename', filesController.previewFile);
router.get('/stats', filesController.getStats);
router.delete('/:filename', filesController.deleteFile);

export default router;
