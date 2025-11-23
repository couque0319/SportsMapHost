import { Router } from 'express';
import * as sportsController from '../controllers/sports.controller.js';

const router = Router();

router.get('/', sportsController.listSports);

export default router;
