import { Router } from 'express';
import * as facilitiesController from '../controllers/facilities.controller.js';

const router = Router();

router.get('/', facilitiesController.listFacilities);
router.get('/:id', facilitiesController.getFacilityDetail);

export default router;
