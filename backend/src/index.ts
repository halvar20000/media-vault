import express from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config';
import { pool } from './db/pool';
import { COVERS_DIR } from './lib/covers';
import { resolveSessionSecret } from './lib/secret';
import { reloadApiKeys, sourcesEnabled } from './lib/apikeys';
import { authRouter } from './routes/auth';
import { itemsRouter } from './routes/items';
import { enrichRouter } from './routes/enrich';
import { searchRouter } from './routes/search';
import { importRouter } from './routes/importCsv';
import { cabinetsRouter } from './routes/cabinets';
import { valueRouter } from './routes/value';
import { barcodeRouter } from './routes/barcode';
import { catalogueRouter } from './routes/catalogue';
import { settingsRouter } from './routes/settings';

const app = express();
app.set('trust proxy', 1); // correct secure-cookie handling behind a reverse proxy

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.appOrigin,
    credentials: true,
  })
);

const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
    name: 'mv.sid',
    secret: resolveSessionSecret(config.sessionSecret, COVERS_DIR),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  })
);

// Serve cached cover images (downloaded during enrichment).
app.use('/api/covers', express.static(COVERS_DIR, { maxAge: '7d', immutable: true }));

// App version: an APP_VERSION env (baked at image build) wins, else package.json.
const APP_VERSION = (() => {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version as string;
  } catch {
    return 'dev';
  }
})();

// Health check (also reports the running version).
app.get('/api/health', (_req, res) => res.json({ ok: true, version: APP_VERSION }));

app.use('/api/auth', authRouter);
app.use('/api/items', itemsRouter);
app.use('/api/enrich', enrichRouter);
app.use('/api/search', searchRouter);
app.use('/api/import', importRouter);
app.use('/api/cabinets', cabinetsRouter);
app.use('/api/value', valueRouter);
app.use('/api/barcode', barcodeRouter);
app.use('/api/catalogue', catalogueRouter);
app.use('/api/settings', settingsRouter);

// Single-image deploy: also serve the built SPA + client-side routing fallback.
if (config.frontendDir) {
  app.use(express.static(config.frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(config.frontendDir, 'index.html'));
  });
}

// Fallback error handler.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, async () => {
  console.log(`[media-vault] API listening on :${config.port}`);
  await reloadApiKeys(); // overlay any in-app key overrides from the DB
  const s = sourcesEnabled();
  console.log(
    `[media-vault] sources → IGDB:${s.igdb ? 'on' : 'off'} ` +
      `TMDB:${s.tmdb ? 'on' : 'off'} Discogs:${s.discogs ? 'on' : 'off'}`
  );
});
