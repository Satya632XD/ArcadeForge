const express = require('express');
const rateLimit = require('express-rate-limit').rateLimit;
const { query } = require('../db');
const { hashPassword, verifyPassword, createSession, revokeSession } = require('../services/auth');
const { cookieName, env, sessionTtlDays } = require('../config');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { fail } = require('../middleware/error');
const { cleanString, toSafeUser } = require('../utils');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false });

function setSessionCookie(res, token) {
  const parts = [
    `${encodeURIComponent(cookieName)}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${sessionTtlDays * 24 * 60 * 60}`,
    'SameSite=Lax'
  ];
  if (env === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [`${encodeURIComponent(cookieName)}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (env === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const username = cleanString(req.body.username, { min: 3, max: 32, name: 'Username' }).toLowerCase();
    const email = cleanString(req.body.email, { min: 5, max: 255, name: 'Email' }).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const displayName = cleanString(req.body.displayName || username, { min: 1, max: 64, name: 'Display name' });

    if (!/^[a-zA-Z0-9_]+$/.test(username)) throw fail(400, 'Username may contain only letters, numbers, and underscores.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
    if (password.length < 8 || password.length > 72) throw fail(400, 'Password must be 8–72 characters.');

    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, is_admin, created_at`,
      [username, email, passwordHash, displayName]
    );
    await query('INSERT INTO wallets (user_id) VALUES ($1)', [result.rows[0].id]);
    const token = await createSession(result.rows[0].id);
    setSessionCookie(res, token);
    res.status(201).json({ user: toSafeUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') error = fail(409, 'Username or email is already registered.', 'ACCOUNT_EXISTS');
    next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const identifier = cleanString(req.body.identifier, { min: 3, max: 255, name: 'Username or email' }).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const result = await query(
      `SELECT id, username, email, display_name, password_hash, is_admin, is_banned, created_at
         FROM users WHERE lower(username) = $1 OR lower(email) = $1 LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) throw fail(401, 'Invalid credentials.', 'INVALID_CREDENTIALS');
    if (user.is_banned) throw fail(403, 'This account is banned.', 'ACCOUNT_BANNED');

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.json({ user: toSafeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', optionalAuth, async (req, res, next) => {
  try {
    await revokeSession(req.cookies?.[cookieName]);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/me', optionalAuth, async (req, res, next) => {
  try {
    if (!req.auth || req.auth.banned) return res.json({ user: null });
    res.json({ user: toSafeUser(req.auth) });
  } catch (error) {
    next(error);
  }
});

router.post('/revoke-all', requireAuth, async (req, res, next) => {
  try {
    await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.auth.id]);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
