// backend/src/routes/index.js
import { Router } from "express";
import sportsRouter from "./sports.routes.js";
import facilitiesRouter from "./facilities.routes.js";
import programsRouter from "./programs.routes.js";
import eventsRouter from "./events.routes.js";

const router = Router();

// 간단 헬스 체크용 루트 엔드포인트
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "SportsMap backend root",
    timestamp: new Date().toISOString(),
  });
});

// 도메인별 하위 라우터 연결
router.use("/sports", sportsRouter);
router.use("/facilities", facilitiesRouter);
router.use("/programs", programsRouter);
router.use("/events", eventsRouter); // 생활체육/행사 크롤링 API

export default router;
