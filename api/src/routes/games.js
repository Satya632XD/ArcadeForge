const express = require('express');
const { query, withTransaction } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { fail } = require('../middleware/error');
const { cleanString, isUuid, mapGame, parsePositiveInt } = require('../utils');

const router = express.Router();
const MAX_SOURCE_BYTES = 200_000;
const MAX_FILE_BYTES = 500_000;
const MAX_PROJECT_BYTES = 2_500_000;

function normalizeFilePath(rawPath) {
  if (typeof rawPath !== 'string') throw fail(400, 'File path must be a string.');
  const trimmed = rawPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!trimmed || trimmed === '.' || trimmed === '..') throw fail(400, 'Invalid file path.');
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return normalizeFilePath(trimmed.replace(/^(\.\/|\/)+/, ''));
  }
  const parts = trimmed.split('/');
  if (parts.some((p) => p === '..' || p === '')) {
    throw fail(400, `Invalid path segment in "${rawPath}". Path cannot contain ".." or empty segments.`);
  }
  if (trimmed.length > 255) throw fail(400, `File path "${rawPath}" exceeds 255 characters.`);
  return trimmed;
}

function validateFilesPayload(inputFiles) {
  const normalized = {};
  let totalBytes = 0;

  if (Array.isArray(inputFiles)) {
    for (const item of inputFiles) {
      if (!item || typeof item !== 'object') throw fail(400, 'Each file entry must be an object with path and content.');
      const path = normalizeFilePath(item.path);
      const content = typeof item.content === 'string' ? item.content : '';
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes > MAX_FILE_BYTES) throw fail(413, `File "${path}" exceeds maximum size of 500 KB.`);
      totalBytes += bytes;
      normalized[path] = content;
    }
  } else if (inputFiles && typeof inputFiles === 'object') {
    for (const [rawPath, rawContent] of Object.entries(inputFiles)) {
      const path = normalizeFilePath(rawPath);
      const content = typeof rawContent === 'string' ? rawContent : '';
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes > MAX_FILE_BYTES) throw fail(413, `File "${path}" exceeds maximum size of 500 KB.`);
      totalBytes += bytes;
      normalized[path] = content;
    }
  } else {
    throw fail(400, 'Files must be an object or array of files.');
  }

  if (totalBytes > MAX_PROJECT_BYTES) {
    throw fail(413, 'Total project files exceed maximum size limit (2.5 MB).');
  }

  return normalized;
}

function validateGameInput(body, partial = false) {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = cleanString(body.title, { min: 1, max: 100, name: 'Title' });
  }
  if (!partial || body.description !== undefined) {
    out.description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
  }

  if (body.files !== undefined) {
    out.files = validateFilesPayload(body.files);
    // Derive fallback sourceCode for backward compatibility
    out.sourceCode = out.files['app.js'] || out.files['main.js'] || out.files['index.html'] || '';
  } else if (!partial || body.sourceCode !== undefined) {
    if (typeof body.sourceCode !== 'string') throw fail(400, 'Source code must be a string.');
    if (Buffer.byteLength(body.sourceCode, 'utf8') > MAX_SOURCE_BYTES) {
      throw fail(413, 'Source code is too large. Maximum is 200 KB.');
    }
    out.sourceCode = body.sourceCode;
  }

  return out;
}

async function getGameFilesMap(clientOrQuery, gameId) {
  const filesResult = await clientOrQuery(
    `SELECT path, content FROM game_files WHERE game_id = $1 ORDER BY path ASC`,
    [gameId]
  );
  if (!filesResult.rows.length) return null;
  const map = {};
  for (const row of filesResult.rows) {
    map[row.path] = row.content;
  }
  return map;
}

const publicSelect = `
  SELECT g.id, g.creator_id, g.title, g.description, g.status, g.created_at, g.updated_at,
         u.username AS creator_username, u.display_name AS creator_display_name,
         COUNT(gs.id)::bigint AS play_count
    FROM games g
    JOIN users u ON u.id = g.creator_id
    LEFT JOIN game_sessions gs ON gs.game_id = g.id
`;

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const sort = ['newest', 'popular'].includes(req.query.sort) ? req.query.sort : 'newest';
    const page = parsePositiveInt(req.query.page, 1, 10000);
    const limit = parsePositiveInt(req.query.limit, 12, 40);
    const offset = (page - 1) * limit;

    let orderBy = 'g.updated_at DESC';
    if (sort === 'popular') orderBy = 'play_count DESC, g.updated_at DESC';

    const params = [];
    const where = [`g.status = 'published'`, `u.is_banned = false`];
    if (q) {
      params.push(`%${q.replace(/[%_]/g, '\\$&')}%`);
      where.push(`(g.title ILIKE $${params.length} ESCAPE '\\' OR g.description ILIKE $${params.length} ESCAPE '\\' OR u.username ILIKE $${params.length} ESCAPE '\\')`);
    }
    params.push(limit, offset);
    const result = await query(
      `${publicSelect}
       WHERE ${where.join(' AND ')}
       GROUP BY g.id, u.username, u.display_name
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ games: result.rows.map(mapGame), page, limit });
  } catch (error) { next(error); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `${publicSelect}
       WHERE g.creator_id = $1
       GROUP BY g.id, u.username, u.display_name
       ORDER BY g.updated_at DESC`,
      [req.auth.id]
    );
    res.json({ games: result.rows.map(mapGame) });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = validateGameInput(req.body);
    const game = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO games (creator_id, title, description, source_code)
         VALUES ($1, $2, $3, $4)
         RETURNING id, creator_id, title, description, source_code, status, created_at, updated_at`,
        [req.auth.id, input.title, input.description, input.sourceCode || '']
      );
      const newGame = result.rows[0];

      if (input.files && Object.keys(input.files).length > 0) {
        for (const [path, content] of Object.entries(input.files)) {
          await client.query(
            `INSERT INTO game_files (game_id, path, content) VALUES ($1, $2, $3)`,
            [newGame.id, path, content]
          );
        }
      }

      return newGame;
    });

    res.status(201).json({
      game: {
        ...mapGame({
          ...game,
          creator_username: req.auth.username,
          creator_display_name: req.auth.display_name,
          play_count: 0
        }),
        sourceCode: game.source_code,
        files: input.files || null
      }
    });
  } catch (error) { next(error); }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw fail(400, 'Invalid game id.');
    const result = await query(
      `SELECT g.id, g.creator_id, g.title, g.description, g.source_code, g.status, g.created_at, g.updated_at,
              u.username AS creator_username, u.display_name AS creator_display_name,
              COUNT(gs.id)::bigint AS play_count
         FROM games g
         JOIN users u ON u.id = g.creator_id
         LEFT JOIN game_sessions gs ON gs.game_id = g.id
        WHERE g.id = $1 AND (g.status = 'published' OR g.creator_id = $2)
        GROUP BY g.id, u.username, u.display_name`,
      [req.params.id, req.auth?.id || null]
    );
    if (!result.rows[0]) throw fail(404, 'Game not found.', 'GAME_NOT_FOUND');
    const row = result.rows[0];
    const response = { game: mapGame(row) };

    if (req.auth?.id === row.creator_id) {
      const filesMap = await getGameFilesMap(query, row.id);
      response.game.files = filesMap;
      response.game.sourceCode = row.source_code;
    }

    res.json(response);
  } catch (error) { next(error); }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw fail(400, 'Invalid game id.');
    const input = validateGameInput(req.body, true);

    const updatedGame = await withTransaction(async (client) => {
      // Check ownership
      const check = await client.query(
        `SELECT id, creator_id, status FROM games WHERE id = $1 AND creator_id = $2 AND status <> 'removed'`,
        [req.params.id, req.auth.id]
      );
      if (!check.rows[0]) throw fail(404, 'Game not found or not owned by you.', 'GAME_NOT_FOUND');

      const fields = [];
      const values = [req.params.id, req.auth.id];
      let i = 3;

      if (input.title !== undefined) {
        fields.push(`title = $${i++}`);
        values.push(input.title);
      }
      if (input.description !== undefined) {
        fields.push(`description = $${i++}`);
        values.push(input.description);
      }
      if (input.sourceCode !== undefined) {
        fields.push(`source_code = $${i++}`);
        values.push(input.sourceCode);
      }

      if (input.files !== undefined) {
        // Sync game_files
        await client.query(`DELETE FROM game_files WHERE game_id = $1`, [req.params.id]);
        for (const [path, content] of Object.entries(input.files)) {
          await client.query(
            `INSERT INTO game_files (game_id, path, content) VALUES ($1, $2, $3)`,
            [req.params.id, path, content]
          );
        }
      }

      if (fields.length > 0 || input.files !== undefined) {
        fields.push('updated_at = now()');
        const updateSql = `
          UPDATE games SET ${fields.join(', ')}
           WHERE id = $1 AND creator_id = $2 AND status <> 'removed'
          RETURNING id, creator_id, title, description, source_code, status, created_at, updated_at
        `;
        const res = await client.query(updateSql, values);
        return res.rows[0];
      }

      const res = await client.query(
        `SELECT id, creator_id, title, description, source_code, status, created_at, updated_at FROM games WHERE id = $1`,
        [req.params.id]
      );
      return res.rows[0];
    });

    const filesMap = await getGameFilesMap(query, updatedGame.id);

    res.json({
      game: {
        id: updatedGame.id,
        creatorId: updatedGame.creator_id,
        title: updatedGame.title,
        description: updatedGame.description,
        sourceCode: updatedGame.source_code,
        files: filesMap,
        status: updatedGame.status,
        createdAt: updatedGame.created_at,
        updatedAt: updatedGame.updated_at
      }
    });
  } catch (error) { next(error); }
});

router.post('/:id/publish', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw fail(400, 'Invalid game id.');
    const result = await query(
      `UPDATE games
          SET status = 'published', updated_at = now()
        WHERE id = $1 AND creator_id = $2 AND status <> 'removed'
        RETURNING id, status, updated_at`,
      [req.params.id, req.auth.id]
    );
    if (!result.rows[0]) throw fail(404, 'Game not found or not owned by you.', 'GAME_NOT_FOUND');
    res.json({ game: result.rows[0] });
  } catch (error) { next(error); }
});

router.post('/:id/unpublish', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw fail(400, 'Invalid game id.');
    const result = await query(
      `UPDATE games
          SET status = 'draft', updated_at = now()
        WHERE id = $1 AND creator_id = $2 AND status = 'published'
        RETURNING id, status, updated_at`,
      [req.params.id, req.auth.id]
    );
    if (!result.rows[0]) throw fail(404, 'Game not found or not currently published.', 'GAME_NOT_FOUND');
    res.json({ game: result.rows[0] });
  } catch (error) { next(error); }
});

router.post('/:id/launch', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw fail(400, 'Invalid game id.');
    const result = await query(
      `SELECT g.id, g.creator_id, g.title, g.description, g.source_code, g.status,
              u.username AS creator_username, u.display_name AS creator_display_name
         FROM games g JOIN users u ON u.id = g.creator_id
        WHERE g.id = $1 AND g.status = 'published' AND u.is_banned = false`,
      [req.params.id]
    );
    const game = result.rows[0];
    if (!game) throw fail(404, 'Published game not found.', 'GAME_NOT_FOUND');

    const session = await query(
      `INSERT INTO game_sessions (game_id, player_id)
       VALUES ($1, $2)
       RETURNING id, started_at`,
      [game.id, req.auth.id]
    );

    const filesMap = await getGameFilesMap(query, game.id);

    res.status(201).json({
      game: {
        id: game.id,
        title: game.title,
        description: game.description,
        sourceCode: game.source_code,
        files: filesMap,
        creator: { id: game.creator_id, username: game.creator_username, displayName: game.creator_display_name }
      },
      playSession: { id: session.rows[0].id, startedAt: session.rows[0].started_at }
    });
  } catch (error) { next(error); }
});

router.post('/:id/end-session', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id) || !isUuid(req.body.sessionId)) throw fail(400, 'Invalid id.');
    const result = await query(
      `UPDATE game_sessions SET ended_at = now()
        WHERE id = $1 AND game_id = $2 AND player_id = $3 AND ended_at IS NULL
        RETURNING id, ended_at`,
      [req.body.sessionId, req.params.id, req.auth.id]
    );
    if (!result.rows[0]) throw fail(404, 'Active play session not found.', 'SESSION_NOT_FOUND');
    res.json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
