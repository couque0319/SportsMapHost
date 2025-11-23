import * as sportsService from '../services/sports.service.js';

export async function listSports(req, res, next) {
  try {
    const result = await sportsService.listSports();
    res.json(result);
  } catch (err) {
    next(err);
  }
}
