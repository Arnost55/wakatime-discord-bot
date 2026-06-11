# WakaTime Discord Bot

A Discord bot that integrates with the [WakaTime API](https://wakatime.com/developers) to display coding stats to users in a Discord server. Users authenticate with their WakaTime account via OAuth2, and the bot fetches and displays their coding statistics.

## Features

- **WakaTime OAuth2 Authorization** — Authenticate users via the official WakaTime OAuth flow
- **Coding Stats** — View total time logged since account creation (`/all-time-since-today`)
- **Secure Token Storage** — Access and refresh tokens are encrypted at rest using libsodium (NaCl) with Argon2id key derivation
- **Self-hosted OAuth API** — Built-in Express server handles the OAuth redirect callback
- **Docker Support** — Ready-to-use Dockerfile and docker-compose for containerized deployment
- **Database Migrations** — Prisma ORM with PostgreSQL for user token persistence

## Slash Commands

| Command                    | Description                                                |
|----------------------------|------------------------------------------------------------|
| `/all-time-since-today`    | Get total time logged on WakaTime since account creation.  |
| `/authorize`               | Authorize this app through the official WakaTime website.  |
| `/revoke`                  | Learn how to revoke WakaTime authorization.                |
| `/help`                    | Display help information about the bot.                    |

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [PostgreSQL](https://www.postgresql.org/) database
- [Discord Bot Token](https://discord.com/developers/applications)
- [WakaTime App](https://wakatime.com/apps) (Client ID & Client Secret)

### Quick Start (Manual)

```bash
# 1. Clone the repository
git clone https://github.com/zFl4wless/wakatime-discord-bot.git
cd wakatime-discord-bot

# 2. Install dependencies
npm install

# 3. Set up the database (PostgreSQL)
#    Option A: Run the setup script
.\db-setup.ps1       # Windows PowerShell
#    OR
./db-setup.sh        # Linux/macOS
#    Option B: Manually run db-setup.sql against your PostgreSQL instance

# 4. Apply Prisma migrations
npx prisma migrate deploy

# 5. Configure environment
cp .env.example .env
# Edit .env with your values (see Configuration below)

# 6. Start the bot (development)
npm run start:dev

# 7. Build and run (production)
npm run build
npm run start:prod
```

### Docker Deployment

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your values

# 2. Start the bot (builds and runs in container)
docker compose up -d
```

The Docker setup will:
- Build the TypeScript source into `dist/`
- Generate the Prisma client
- Run database migrations on startup
- Persist the encryption salt via a mounted volume (`salt.txt`)

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable            | Required | Description                                                                |
|---------------------|----------|----------------------------------------------------------------------------|
| `BOT_TOKEN`         | Yes      | Your Discord bot token from the [Developer Portal](https://discord.com/developers/applications). |
| `GUILD_ID`          | Yes*     | The Discord server (guild) ID to register commands on. Remove for global commands. |
| `DATABASE_URL`      | Yes      | PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/wakatime-bot?schema=public`). |
| `API_URL`           | Yes      | Public URL of your OAuth redirect API (e.g., `https://your-domain.com` or `http://localhost:3000`). |
| `API_PORT`          | No       | Port for the OAuth redirect API server (default: `3000`).                  |
| `CLIENT_ID`         | Yes      | Your WakaTime OAuth App client ID (from [WakaTime Apps](https://wakatime.com/apps)). |
| `CLIENT_SECRET`     | Yes      | Your WakaTime OAuth App client secret.                                     |
| `WAKATIME_BASE_URL` | No       | Base URL for the WakaTime API (default: `https://wakatime.com`). Useful for self-hosted WakaTime-compatible instances like [Hakatime](https://github.com/mujx/hakatime). |
| `CRYPTO_PASSWORD`   | Yes      | Password used to derive encryption keys via Argon2id for token storage. Choose a strong, random password. |

> **\*** `GUILD_ID` is required if you want the bot to work in a specific server. Remove it from `.env` to register commands globally (may take up to 1 hour to propagate).

## Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│   Discord API   │◄─────►│   Discord Bot (src)   │──────►│   WakaTime API  │
└─────────────────┘       │                       │       └─────────────────┘
                          │  ┌─────────────────┐  │              ▲
                          │  │  Slash Commands  │  │              │
                          │  │  • all-time-     │  │   OAuth2     │
                          │  │    since-today   │  │   Bearer     │
                          │  │  • authorize     │  │   Token      │
                          │  │  • revoke        │  │              │
                          │  │  • help          │  │              │
                          │  └────────┬────────┘  │              │
                          │           │            │              │
                          │  ┌────────▼────────┐  │              │
                          │  │   Event System  │  │              │
                          │  │  • interaction  │  │              │
                          │  │    Create       │  │              │
                          │  │  • ready        │  │              │
                          │  └─────────────────┘  │              │
                          └───────────────────────┘              │
                                      │                          │
                                      ▼                          │
                          ┌──────────────────────┐               │
                          │  Express OAuth API   │───────────────┘
                          │  POST /redirect      │  Exchanges auth
                          │                      │  code for tokens
                          └──────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────┐
                          │   PostgreSQL (Prisma) │
                          │   • User (encrypted   │
                          │     tokens)           │
                          └──────────────────────┘
```

### Key Directories

| Path                  | Description                                      |
|-----------------------|--------------------------------------------------|
| `src/index.ts`        | Application entry point — initializes bot, API, crypto |
| `src/structure/`      | Core classes: `Client`, `Command`, `Event`       |
| `src/commands/`       | Slash command implementations                    |
| `src/events/`         | Discord event handlers (`interactionCreate`, `ready`) |
| `src/api/`            | Express OAuth redirect server                    |
| `src/wakatime/`       | WakaTime API client and HTTP response codes      |
| `src/db/`             | Prisma database client and user model            |
| `src/utils/`          | Crypto (libsodium encryption) and embed helpers  |
| `src/types/`          | TypeScript type definitions                      |
| `prisma/`             | Prisma schema and migrations                     |

## Scripts

| Script            | Description                                |
|-------------------|--------------------------------------------|
| `npm start`       | Run with `ts-node` (production-like)       |
| `npm run start:dev` | Run with `ts-node-dev` (auto-restart on changes) |
| `npm run start:prod` | Run compiled JS from `dist/`               |
| `npm run build`   | Compile TypeScript to `dist/`              |
| `npm run watch`   | Watch mode — recompile on changes          |

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Discord Library:** [discord.js](https://discord.js.org/) v14
- **Database:** PostgreSQL + [Prisma ORM](https://www.prisma.io/)
- **OAuth API:** [Express](https://expressjs.com/)
- **Encryption:** [libsodium-wrappers-sumo](https://github.com/jedisct1/libsodium.js) (NaCl secretbox + Argon2id key derivation)
- **HTTP Client:** [Axios](https://axios-http.com/)
- **Logging:** [tslog](https://tslog.js.org/)

## License

This project is licensed under the MIT License — see the [LICENCE](LICENCE) file for details.

## Bugs or Feature Requests?

If you find a bug or have a suggestion, please open an issue on the [GitHub repository](https://github.com/zFl4wless/wakatime-discord-bot/issues).
