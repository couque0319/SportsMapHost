import { Router } from 'express';
import sportsRouter from './sports.routes.js';
import facilitiesRouter from './facilities.routes.js';
import programsRouter from './programs.routes.js';

const router = Router();

router.use('/sports', sportsRouter);
router.use('/facilities', facilitiesRouter);
router.use('/programs', programsRouter);

export default router;
