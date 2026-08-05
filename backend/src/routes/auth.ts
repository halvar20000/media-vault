import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
}

function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, displayName: u.display_name };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? '').trim() || null;

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
  if (password.length < 8)
    return res.status(400).json({ error: 'password must be at least 8 characters' });

  const existing = await query<UserRow>('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const rows = await query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3) RETURNING id, email, password_hash, display_name`,
    [email, hash, displayName]
  );
  req.session.userId = rows[0].id;
  res.status(201).json({ user: publicUser(rows[0]) });
});

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const rows = await query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const rows = await query<UserRow>('SELECT * FROM users WHERE id = $1', [
    req.session.userId,
  ]);
  if (!rows.length) return res.status(401).json({ error: 'not authenticated' });
  res.json({ user: publicUser(rows[0]) });
});
