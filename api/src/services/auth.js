const bcrypt = require('bcryptjs');
const { withTransaction } = require('../db');
const { sessionTtlDays } = require('../config');
const { createSessionToken, hashToken } = require('../utils');

async function createSession(userId) {
  return withTransaction(async (client) => {
    const token = createSessionToken();
    await client.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
      [userId, hashToken(token), sessionTtlDays]
    );
    return token;
  });
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function revokeSession(token) {
  if (!token) return;
  const hash = hashToken(token);
  await withTransaction(async (client) => {
    await client.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hash]);
  });
}

module.exports = { createSession, verifyPassword, hashPassword, revokeSession };
