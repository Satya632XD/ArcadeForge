const { query } = require('../db');
const { cookieName } = require('../config');
const { hashToken } = require('../utils');
const { fail } = require('./error');

async function loadAuth(req) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;

  const result = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.is_admin, u.is_banned, u.created_at,
            s.id AS session_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1`,
    [hashToken(token)]
  );

  if (!result.rows[0]) return null;
  const row = result.rows[0];
  if (row.is_banned) return { ...row, banned: true };
  return row;
}

async function optionalAuth(req, res, next) {
  try {
    req.auth = await loadAuth(req);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuth(req, res, next) {
  try {
    req.auth = await loadAuth(req);
    if (!req.auth || req.auth.banned) throw fail(401, 'Authentication required.', 'UNAUTHENTICATED');
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { optionalAuth, requireAuth, loadAuth };
