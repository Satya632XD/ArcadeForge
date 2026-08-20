const crypto = require('node:crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parsePositiveInt(value, fallback, max = 100) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function cleanString(value, { min = 0, max, name }) {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new Error(`${name} is too short`);
  if (trimmed.length > max) throw new Error(`${name} is too long`);
  return trimmed;
}

function toSafeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    createdAt: row.created_at
  };
}

function mapGame(row) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorUsername: row.creator_username,
    creatorDisplayName: row.creator_display_name,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    playCount: Number(row.play_count || 0)
  };
}

function formatAmount(value) {
  return Number(value);
}

module.exports = {
  hashToken,
  createSessionToken,
  isUuid,
  parsePositiveInt,
  cleanString,
  toSafeUser,
  mapGame,
  formatAmount
};
