const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getWallet, createMockPurchase } = require('../services/ledger');
const { fail } = require('../middleware/error');
const { mockPurchaseEnabled } = require('../config');

const router = express.Router();
const PACKAGES = {
  starter: { usdCents: 99, currencyAmount: 1000 },
  creator: { usdCents: 499, currencyAmount: 5500 },
  mega: { usdCents: 999, currencyAmount: 12000 }
};

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const wallet = await getWallet(req.auth.id);
    res.json({ balance: Number(wallet.balance), updatedAt: wallet.updated_at });
  } catch (error) { next(error); }
});

router.get('/packages', requireAuth, (req, res) => {
  res.json({ packages: Object.entries(PACKAGES).map(([id, value]) => ({ id, ...value })) });
});

router.post('/mock-purchase', requireAuth, async (req, res, next) => {
  try {
    if (!mockPurchaseEnabled) throw fail(403, 'Mock purchases are disabled.', 'MOCK_PURCHASE_DISABLED');
    const packageId = typeof req.body.packageId === 'string' ? req.body.packageId : '';
    const pkg = PACKAGES[packageId];
    if (!pkg) throw fail(400, 'Unknown purchase package.');

    const idempotencyKey = typeof req.body.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(idempotencyKey)) throw fail(400, 'A valid idempotency key is required.');

    const result = await createMockPurchase({
      userId: req.auth.id,
      usdCents: pkg.usdCents,
      currencyAmount: pkg.currencyAmount,
      providerRef: `mock:${req.auth.id}:${idempotencyKey}`
    });
    const wallet = await getWallet(req.auth.id);
    res.status(result.duplicate ? 200 : 201).json({ purchase: result.purchase, balance: Number(wallet.balance), duplicate: result.duplicate });
  } catch (error) { next(error); }
});

router.get('/transactions', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.id, t.type, t.from_user_id, t.to_user_id, t.amount, t.game_id, t.related_tx_id,
              t.metadata, t.created_at, g.title AS game_title,
              fu.username AS from_username, tu.username AS to_username
         FROM transactions t
         LEFT JOIN games g ON g.id = t.game_id
         LEFT JOIN users fu ON fu.id = t.from_user_id
         LEFT JOIN users tu ON tu.id = t.to_user_id
        WHERE t.from_user_id = $1 OR t.to_user_id = $1
        ORDER BY t.created_at DESC LIMIT 100`,
      [req.auth.id]
    );
    res.json({ transactions: result.rows.map(mapTx) });
  } catch (error) { next(error); }
});

function mapTx(row) {
  let direction = 'system';
  if (row.to_user_id === row.from_user_id) direction = 'self';
  else if (row.to_user_id === row.from_user_id) direction = 'in';
  else if (row.to_user_id) direction = 'in';
  else if (row.from_user_id) direction = 'out';
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    gameId: row.game_id,
    gameTitle: row.game_title,
    fromUsername: row.from_username,
    toUsername: row.to_username,
    relatedTxId: row.related_tx_id,
    metadata: row.metadata,
    direction,
    createdAt: row.created_at
  };
}

module.exports = router;
