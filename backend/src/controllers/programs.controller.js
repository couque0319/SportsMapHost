// backend/src/controllers/programs.controller.js
import { getProgramHighlights } from '../services/programs.service.js';

export async function getProgramHighlightsController(req, res, next) {
  try {
    const limit = req.query.limit
      ? Math.min(parseInt(req.query.limit, 10) || 3, 12)
      : 3;

    const items = await getProgramHighlights(limit);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}
