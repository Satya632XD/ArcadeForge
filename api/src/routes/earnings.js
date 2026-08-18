const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type = 'creator_payout'), 0)::bigint AS total_earned,
         COUNT(*) FILTER (WHERE type = 'creator_payout')::bigint AS payout_count,
         COALESCE(SUM(amount) FILTER (WHERE type = 'platform_fee'), 0)::bigint AS platform_fee_generated
       FROM transactions
       WHERE to_user_id = $1 OR game_id IN (SELECT id FROM games WHERE creator_id = $1)`,
      [req.auth.id]
    );
    const games = await query(
      `SELECT g.id, g.title, g.play_price,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'creator_payout' AND t.to_user_id = $1), 0)::bigint AS earned
         FROM games g
         LEFT JOIN transactions t ON t.game_id = g.id
        WHERE g.creator_id = $1
        GROUP BY g.id
        ORDER BY earned DESC, g.updated_at DESC`,
      [req.auth.id]
    );
    res.json({
      totalEarned: Number(result.rows[0].total_earned),
      payoutCount: Number(result.rows[0].payout_count),
      games: games.rows.map((g) => ({ id: g.id, title: g.title, playPrice: Number(g.play_price), earned: Number(g.earned) }))
    });
  } catch (error) { next(error); }
});

module.exports = router;
