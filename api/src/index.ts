import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users';
import balancesRouter from './routes/balances';
import expiryRouter from './routes/expiry';

const app = express();
const port = parseInt(process.env['PORT'] ?? '3000', 10);

const allowedOrigins = [
  'http://localhost:4200',
  'https://tally-theta-two.vercel.app',
  'https://tally.vercel.app',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Render health checks, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

// Health check — Render pings this to keep the service warm
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', usersRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/expiry', expiryRouter);

app.listen(port, () => {
  console.log(`Tally API running on port ${port}`);
});
