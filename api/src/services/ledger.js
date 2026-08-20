const { withTransaction } = require('../db');

async function ensureWallet(client, userId) {
  await client.query(
    `INSERT INTO wallets (user_id, balance) VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getWallet(userId) {
  const { query } = require('../db');
  await query(`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const result = await query('SELECT user_id, balance, updated_at FROM wallets WHERE user_id = $1', [userId]);
  return result.rows[0];
}

async function createMockPurchase({ userId, usdCents, currencyAmount, providerRef }) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [providerRef]);
    const existing = await client.query(
      `SELECT id, user_id, usd_cents, currency_amount, provider, provider_ref, status, created_at
         FROM purchases WHERE provider_ref = $1 LIMIT 1`,
      [providerRef]
    );
    if (existing.rows[0]) return { purchase: existing.rows[0], duplicate: true };

    await ensureWallet(client, userId);
    await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);

    const tx = await client.query(
      `INSERT INTO transactions (type, from_user_id, to_user_id, amount, metadata)
       VALUES ('purchase', NULL, $1, $2, $3::jsonb)
       RETURNING id, created_at`,
      [userId, currencyAmount.toString(), JSON.stringify({ provider: 'placeholder', providerRef })]
    );
    const purchase = await client.query(
      `INSERT INTO purchases (user_id, usd_cents, currency_amount, provider, provider_ref, status)
       VALUES ($1, $2, $3, 'placeholder', $4, 'completed')
       RETURNING id, user_id, usd_cents, currency_amount, provider, provider_ref, status, created_at`,
      [userId, usdCents, currencyAmount.toString(), providerRef]
    );
    await client.query(
      `UPDATE wallets SET balance = balance + $2, updated_at = now() WHERE user_id = $1`,
      [userId, currencyAmount.toString()]
    );
    return { purchase: purchase.rows[0], transactionId: tx.rows[0].id, duplicate: false };
  });
}

module.exports = { getWallet, createMockPurchase };
