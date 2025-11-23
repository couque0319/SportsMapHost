// backend/src/routes/programs.routes.js
import { Router } from 'express';
import { getProgramHighlightsController } from '../controllers/programs.controller.js';

const router = Router();

// GET /api/programs/highlights?limit=3
router.get('/highlights', getProgramHighlightsController);

export default router;
