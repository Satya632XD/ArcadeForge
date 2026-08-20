-- ============================================================
-- PLATFORM SCHEMA
-- Server is the single source of truth for identity, currency,
-- and permissions. Nothing here is ever trusted from the client.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username        VARCHAR(32) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  display_name    VARCHAR(64) NOT NULL,
  is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- SESSIONS
-- ------------------------------------------------------------
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ------------------------------------------------------------
-- WALLETS
-- ------------------------------------------------------------
CREATE TABLE wallets (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance         BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- GAMES
-- ------------------------------------------------------------
CREATE TABLE games (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(100) NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  source_code     TEXT NOT NULL DEFAULT '',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'removed')),
  play_price      BIGINT NOT NULL DEFAULT 0 CHECK (play_price >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_games_creator ON games(creator_id);
CREATE INDEX idx_games_status ON games(status);

-- ------------------------------------------------------------
-- GAME FILES
-- ------------------------------------------------------------
CREATE TABLE game_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  path            VARCHAR(255) NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, path)
);
CREATE INDEX idx_game_files_game ON game_files(game_id);

-- ------------------------------------------------------------
-- TRANSACTIONS
-- ------------------------------------------------------------
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            VARCHAR(30) NOT NULL CHECK (type IN (
                    'purchase',
                    'game_play_spend',
                    'creator_payout',
                    'platform_fee',
                    'admin_adjustment'
                  )),
  from_user_id    UUID REFERENCES users(id),
  to_user_id      UUID REFERENCES users(id),
  amount          BIGINT NOT NULL CHECK (amount > 0),
  game_id         UUID REFERENCES games(id),
  related_tx_id   UUID REFERENCES transactions(id),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_from ON transactions(from_user_id);
CREATE INDEX idx_tx_to ON transactions(to_user_id);
CREATE INDEX idx_tx_game ON transactions(game_id);

-- ------------------------------------------------------------
-- PURCHASES
-- ------------------------------------------------------------
CREATE TABLE purchases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  usd_cents       INTEGER NOT NULL CHECK (usd_cents > 0),
  currency_amount BIGINT NOT NULL CHECK (currency_amount > 0),
  provider        VARCHAR(30) NOT NULL DEFAULT 'placeholder',
  provider_ref    TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- GAME PLAY SESSIONS
-- ------------------------------------------------------------
CREATE TABLE game_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  currency_awarded_total BIGINT NOT NULL DEFAULT 0,
  currency_spent_total   BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_game_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_game_sessions_game ON game_sessions(game_id);
