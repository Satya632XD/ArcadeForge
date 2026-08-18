const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { port, webOrigin } = require('./config');
const { cookieParser } = require('./middleware/cookies');
const { notFound, errorHandler } = require('./middleware/error');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const walletRoutes = require('./routes/wallet');
const earningsRoutes = require('./routes/earnings');
const { query } = require('./db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({ origin: webOrigin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '300kb' }));
app.use(cookieParser);

app.get('/health', async (req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, service: 'api', database: 'ok' });
  } catch (error) { next(error); }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/earnings', earningsRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
