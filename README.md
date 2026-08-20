ArcadeForge — Code-First Game Publishing MVP
This repository is a complete React + Express + PostgreSQL MVP built around the supplied schema.sql. It is designed to run entirely on free managed cloud services — no Docker, and no local database required.
Deployment architecture
Database — managed PostgreSQL via Supabase or Neon. No local Postgres install needed; the API connects using a DATABASE_URL connection string.
API — the Express app in /api deploys as a plain Node.js web service (e.g. on Render or Fly.io). It binds to process.env.PORT and 0.0.0.0, so it works on any standard Node host.
Frontend — the Vite/React app in /web builds to static files and deploys to any static host (e.g. Vercel, Netlify, or Cloudflare Pages). It talks to the API over HTTPS using a configurable VITE_API_URL.
Android (future) — Capacitor will later package only the built /web frontend into a native app. The native app will call the same hosted API over HTTPS; the API is never bundled into the app.
No Docker is required for local development or for production deployment.
Included
Server-side session authentication with bcrypt password hashes and an HttpOnly session cookie
User profiles and a creator Studio
JavaScript-only game creation/editing/publishing
Public game discovery, search, and sorting by newest/popularity
Sandboxed game runtime using <iframe sandbox="allow-scripts"> and a narrow postMessage contract
Games are free to launch and play. Launching never deducts GC, never checks wallet balance, and never triggers a creator/platform split.
Append-only transaction ledger plus wallet balance updates inside PostgreSQL transactions
Mock currency purchases with idempotency protection — this is currently the only way GC enters a wallet
Creator earnings summary (for future in-game monetization, not launch fees)
Central Express error handling, CORS, Helmet, rate limiting, validation, and ownership checks
GC economy
GC ("game currency") only enters a player's wallet through a real-money purchase (purchases table / mock purchase flow in ledger.js). Launching or playing a game is always free and never touches the ledger. Future work will add creator-defined in-game purchases (cosmetics, tips, unlocks, subscriptions) that spend GC inside a running game — that system does not exist yet.
REAL MONEY → GC PURCHASE → PLAYER WALLET → (future) IN-GAME PURCHASE → CREATOR / PLATFORM LEDGER
Running locally
API
cd api
cp .env.example .env   # fill in DATABASE_URL, WEB_ORIGINS, etc.
npm install
npm run dev             # or: npm start
Frontend
cd web
npm install
npm run dev
Set VITE_API_URL in web/.env (or your host's env settings) to point at the API's URL. If unset, the frontend falls back to a relative /api path for local development.
Deploying
Database: create a free Postgres project on Supabase or Neon, then run schema.sql against it. Copy the connection string into DATABASE_URL.
API (Render example): create a new Web Service pointed at the api/ directory, build command npm install, start command npm start. Set the environment variables from api/.env.example (DATABASE_URL, WEB_ORIGINS, COOKIE_SAME_SITE=none, COOKIE_SECURE=true, etc). Render's free tier sleeps after inactivity and takes 30–60s to wake on the next request — this is a real limitation of the free tier, not a bug.
Frontend (Vercel/Netlify/Cloudflare Pages example): point the host at web/, build command npm run build, output directory dist. Set VITE_API_URL to your deployed API's URL.
Important schema-driven limitations
The provided schema does not contain a game icon column or a separate game-files/assets table, so this MVP stores one JavaScript source_code value per game. The UI uses generated visual artwork for cards instead of a stored icon. games.play_price still exists in the schema for compatibility but has no functional meaning anywhere in the app — it is not read, charged, or exposed in any UI. A future migration can add asset/file tables and an in-game purchase system without changing the server-authoritative wallet/auth model.
The runtime intentionally exposes no arbitrary backend request bridge to game code. The only browser-to-parent messages currently supported are game-ready and resize/context messages. Currency and permission decisions remain server-side, and user game code can never call the API or touch wallet state directly.
Mock purchases use fixed packages and never contact a real payment provider. Replacing the placeholder provider later should create/confirm a purchase on the server and credit the same ledger path; the client must never be allowed to choose a wallet balance.
