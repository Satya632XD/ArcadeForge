# ArcadeForge — Code-First Game Publishing MVP

This repository is a complete React + Express + PostgreSQL MVP built around the supplied `schema.sql`.

## Included

- Server-side session authentication with bcrypt password hashes and HttpOnly session cookie
- User profiles and creator Studio
- JavaScript-only game creation/editing/publishing
- Public game discovery, search, and sorting by newest/popularity/price
- Sandboxed game runtime using `<iframe sandbox="allow-scripts">` and a narrow `postMessage` contract
- Server-authoritative paid-play charges
- Append-only transaction ledger plus wallet balance updates in PostgreSQL transactions
- Mock currency purchases with idempotency protection
- 15% platform fee / 85% creator payout calculation
- Creator earnings summary
- Docker Compose for PostgreSQL, API, and production web container
- Central Express error handling, CORS, Helmet, rate limiting, validation, and ownership checks

## Important schema-driven limitations

The provided schema is authoritative and does not contain a game icon column or a separate game-files/assets table. Therefore this MVP stores one JavaScript `source_code` value per game. The UI uses generated visual artwork for cards instead of storing an icon. A future migration can add asset/file tables without changing the server-authoritative wallet/auth model.

The runtime intentionally exposes no arbitrary backend request bridge to game code. The only browser-to-parent messages currently supported are game-ready and resize/context messages. Currency and permission decisions remain server-side.

Mock purchases use fixed packages and never contact a real payment provider. Replacing the placeholder provider later should create/confirm a purchase on the server and credit the same ledger path; the client must never be allowed to choose a wallet balance.
