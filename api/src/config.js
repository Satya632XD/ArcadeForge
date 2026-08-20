const path = require('node:path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (/^(true|1)$/i.test(value)) return true;
  if (/^(false|0)$/i.test(value)) return false;
  throw new Error(`Environment variable ${name} must be true or false.`);
}

function readOrigins() {
  const value = process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || 'http://localhost:5173';
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length) throw new Error('WEB_ORIGINS must contain at least one origin.');
  return origins;
}

const required = ['DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const env = process.env.NODE_ENV || 'development';
const cookieSameSiteName = String(process.env.COOKIE_SAME_SITE || (env === 'production' ? 'none' : 'lax')).toLowerCase();
const cookieSameSiteValues = { lax: 'Lax', strict: 'Strict', none: 'None' };
if (!cookieSameSiteValues[cookieSameSiteName]) {
  throw new Error('COOKIE_SAME_SITE must be lax, strict, or none.');
}
const cookieSecure = readBoolean('COOKIE_SECURE', env === 'production' || cookieSameSiteName === 'none');
if (cookieSameSiteName === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.');
}

module.exports = {
  env,
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: readBoolean('DATABASE_SSL', true),
  databaseSslRejectUnauthorized: readBoolean('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
  webOrigins: readOrigins(),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  cookieName: process.env.COOKIE_NAME || 'platform_session',
  cookieSameSite: cookieSameSiteValues[cookieSameSiteName],
  cookieSecure,
  currencySymbol: process.env.CURRENCY_SYMBOL || 'GC',
  mockPurchaseEnabled: String(process.env.MOCK_PURCHASE_ENABLED || 'true') === 'true'
};
