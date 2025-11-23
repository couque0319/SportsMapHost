import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import router from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';


const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 메인 라우터
app.use('/api', router);

app.use(errorHandler);

export default app;
