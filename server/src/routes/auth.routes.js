import { Router } from 'express';
import { query, one } from '../db.js';
import { hashPassword, verifyPassword, signToken, authenticate, wrap } from '../lib/auth.js';

const router = Router();

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

router.post('/register', wrap(async (req, res) => {
  const { username, email, password, fullName, phone, role, village } = req.body;

  if (!username || !email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'All required fields must be filled in' });
  }
  if (!USERNAME_RE.test(String(username).toLowerCase())) {
    return res.status(400).json({ error: 'Username must be 3-24 characters: letters, numbers, dot or underscore' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!['leader', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Only community leader and member accounts can self-register' });
  }

  const uname = String(username).toLowerCase();
  const existing = await one('SELECT id FROM users WHERE username = $1 OR email = $2', [uname, email]);
  if (existing) return res.status(409).json({ error: 'That username or email is already registered' });

  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, full_name, phone, role, village)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, username, email, full_name, role, village`,
    [uname, email, await hashPassword(password), fullName, phone || null, role, village || null]
  );
  const user = rows[0];
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', wrap(async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const user = await one(
    'SELECT * FROM users WHERE username = $1 OR email = $1',
    [String(username).toLowerCase()]
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  if (role && user.role !== role) {
    return res.status(403).json({ error: `This account is registered as a ${user.role}. Switch the tab above and try again.` });
  }

  delete user.password_hash;
  res.json({ token: signToken(user), user });
}));

router.get('/me', authenticate, wrap(async (req, res) => {
  const user = await one(
    'SELECT id, username, email, full_name, phone, role, village, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'Account not found' });
  res.json({ user });
}));

export default router;
