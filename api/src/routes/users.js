const express = require('express');
const { query } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { fail } = require('../middleware/error');
const { cleanString } = require('../utils');

const router = express.Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.display_name, u.is_admin, u.created_at,
              COALESCE((SELECT COUNT(*) FROM games g WHERE g.creator_id = u.id), 0) AS game_count
         FROM users u WHERE u.id = $1`,
      [req.auth.id]
    );
    res.json({
      profile: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        displayName: result.rows[0].display_name,
        isAdmin: result.rows[0].is_admin,
        createdAt: result.rows[0].created_at,
        gameCount: Number(result.rows[0].game_count)
      }
    });
  } catch (error) { next(error); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const displayName = cleanString(req.body.displayName, { min: 1, max: 64, name: 'Display name' });
    const result = await query(
      `UPDATE users SET display_name = $2 WHERE id = $1
       RETURNING id, username, email, display_name, is_admin, created_at`,
      [req.auth.id, displayName]
    );
    res.json({ profile: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/:username', optionalAuth, async (req, res, next) => {
  try {
    const username = cleanString(req.params.username, { min: 1, max: 32, name: 'Username' });
    const userResult = await query(
      `SELECT id, username, display_name, created_at
         FROM users WHERE lower(username) = lower($1) AND is_banned = false LIMIT 1`,
      [username]
    );
    const user = userResult.rows[0];
    if (!user) throw fail(404, 'Profile not found.', 'PROFILE_NOT_FOUND');

    const gamesResult = await query(
      `SELECT g.id, g.title, g.description, g.status, g.created_at, g.updated_at,
              u.username AS creator_username, u.display_name AS creator_display_name,
              COUNT(gs.id) FILTER (WHERE gs.ended_at IS NULL OR gs.ended_at IS NOT NULL) AS play_count,
              g.creator_id
         FROM games g
         JOIN users u ON u.id = g.creator_id
         LEFT JOIN game_sessions gs ON gs.game_id = g.id
        WHERE g.creator_id = $1 AND g.status = 'published'
        GROUP BY g.id, u.username, u.display_name
        ORDER BY g.updated_at DESC`,
      [user.id]
    );

    res.json({
      profile: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at
      },
      games: gamesResult.rows.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        status: g.status,
        playCount: Number(g.play_count),
        creatorId: g.creator_id,
        creatorUsername: g.creator_username,
        creatorDisplayName: g.creator_display_name,
        createdAt: g.created_at,
        updatedAt: g.updated_at
      }))
    });
  } catch (error) { next(error); }
});

module.exports = router;
