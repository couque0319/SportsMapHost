import { Router } from 'express';
import { supabase } from '../services/supabaseClient.js';

const router = Router();

// GET /api/test-db
router.get('/', async (req, res, next) => {
  try {
    const { count, error } = await supabase
      .from('facilities')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    res.json({
      ok: true,
      facilitiesCount: count
    });
  } catch (err) {
    next(err);
  }
});

export default router;
