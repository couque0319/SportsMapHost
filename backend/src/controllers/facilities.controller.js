import * as facilityService from '../services/facility.service.js';

export async function listFacilities(req, res, next) {
  try {
    const { sido, sigungu, q, page = 1, pageSize = 20 } = req.query;

    const result = await facilityService.listFacilities({
      sido,
      sigungu,
      q,
      page: Number(page),
      pageSize: Number(pageSize)
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getFacilityDetail(req, res, next) {
  try {
    const id = Number(req.params.id);
    const facility = await facilityService.getFacilityDetail(id);

    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    res.json(facility);
  } catch (err) {
    next(err);
  }
}
