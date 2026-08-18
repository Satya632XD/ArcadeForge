const path = require('node:path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const required = ['DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  cookieName: process.env.COOKIE_NAME || 'platform_session',
  currencySymbol: process.env.CURRENCY_SYMBOL || 'GC',
  mockPurchaseEnabled: String(process.env.MOCK_PURCHASE_ENABLED || 'true') === 'true'
};
