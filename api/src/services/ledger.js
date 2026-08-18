const { withTransaction } = require('../db');
const { fail } = require('../middleware/error');

function asPositiveBigInt(value) {
  try {
    const n = BigInt(value);
    if (n <= 0n) throw new Error();
    return n;
  } catch {
    throw fail(400, 'Amount must be a positive integer.');
  }
}

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

async function spendForGame({ playerId, gameId }) {
  return withTransaction(async (client) => {
    const gameResult = await client.query(
      `SELECT id, creator_id, title, status, play_price
         FROM games WHERE id = $1 FOR UPDATE`,
      [gameId]
    );
    const game = gameResult.rows[0];
    if (!game) throw fail(404, 'Game not found.', 'GAME_NOT_FOUND');
    if (game.status !== 'published') throw fail(409, 'Game is not published.', 'GAME_NOT_PUBLISHED');

    const price = BigInt(game.play_price);
    await ensureWallet(client, playerId);
    await ensureWallet(client, game.creator_id);

    if (playerId === game.creator_id || price === 0n) {
      const session = await client.query(
        `INSERT INTO game_sessions (game_id, player_id, currency_spent_total)
         VALUES ($1, $2, 0) RETURNING id, started_at`,
        [gameId, playerId]
      );
      return { charged: false, amount: 0n, session: session.rows[0] };
    }

    const wallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [playerId]);
    const balance = BigInt(wallet.rows[0].balance);
    if (balance < price) throw fail(402, 'Not enough currency to play this game.', 'INSUFFICIENT_FUNDS');

    const fee = (price * 15n) / 100n;
    const payout = price - fee;
    if (payout <= 0n) throw fail(400, 'Play price is too small for the current platform fee policy.', 'PRICE_TOO_SMALL');

    const spend = await client.query(
      `INSERT INTO transactions (type, from_user_id, amount, game_id, metadata)
       VALUES ('game_play_spend', $1, $2, $3, $4::jsonb)
       RETURNING id`,
      [playerId, price.toString(), gameId, JSON.stringify({ platformFeeBps: 1500 })]
    );
    await client.query(
      `UPDATE wallets SET balance = balance - $2, updated_at = now() WHERE user_id = $1`,
      [playerId, price.toString()]
    );

    const payoutTx = await client.query(
      `INSERT INTO transactions (type, to_user_id, amount, game_id, related_tx_id, metadata)
       VALUES ('creator_payout', $1, $2, $3, $4, $5::jsonb)
       RETURNING id`,
      [game.creator_id, payout.toString(), gameId, spend.rows[0].id, JSON.stringify({ percentage: 85 })]
    );
    await client.query(
      `UPDATE wallets SET balance = balance + $2, updated_at = now() WHERE user_id = $1`,
      [game.creator_id, payout.toString()]
    );

    if (fee > 0n) {
      await client.query(
        `INSERT INTO transactions (type, amount, game_id, related_tx_id, metadata)
         VALUES ('platform_fee', $1, $2, $3, $4::jsonb)`,
        [fee.toString(), gameId, spend.rows[0].id, JSON.stringify({ percentage: 15, rounded: fee * 100n !== price * 15n })]
      );
    }

    const session = await client.query(
      `INSERT INTO game_sessions (game_id, player_id, currency_spent_total)
       VALUES ($1, $2, $3) RETURNING id, started_at`,
      [gameId, playerId, price.toString()]
    );

    return {
      charged: true,
      amount: price,
      fee,
      payout,
      spendTransactionId: spend.rows[0].id,
      payoutTransactionId: payoutTx.rows[0].id,
      session: session.rows[0]
    };
  });
}

module.exports = { getWallet, createMockPurchase, spendForGame };
