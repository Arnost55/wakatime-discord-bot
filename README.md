# WakaTime Discord Bot

A Discord bot that integrates with the [WakaTime API](https://wakatime.com/developers) to display coding stats to users in a Discord server. Users authenticate with their WakaTime account via OAuth2, and the bot fetches and displays their coding statistics.

## Features

- **WakaTime OAuth2 Authorization** — Authenticate users via the official WakaTime OAuth flow
- **Profile & Charts** — View coding profiles with rich pie/bar charts rendered via QuickChart (`/profile`, `/project`)
- **Server Leaderboard** — Rank all registered users by total coding time with paginated charts (`/rank`)
- **User Comparison** — Compare coding stats between two users side-by-side (`/compare`)
- **Language Analytics** — Server-wide top languages and per-language breakdown (`/toplangs`, `/languagestats`)
- **Goals Tracking** — View your WakaTime goals with progress bars (`/goals`)
- **Daily Digest** — Automatically post a daily coding digest to a configured channel (`/digest`)
- **Time Ranges** — Most commands support customizable time ranges (7 days, 30 days, 6 months, year, all time)
- **Coding Stats** — View total time logged since account creation (`/all-time-since-today`)
- **Secure Token Storage** — Access and refresh tokens are encrypted at rest using libsodium (NaCl) with Argon2id key derivation
- **Self-hosted OAuth API** — Built-in Express server handles the OAuth redirect callback
- **Docker Support** — Ready-to-use Dockerfile and docker-compose for containerized deployment
- **Database Migrations** — Prisma ORM with PostgreSQL for user token persistence

## Slash Commands

| Command                                         | Description                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/authorize`                                    | Authorize this app through the official WakaTime website.                                          |
| `/profile [user] [range]`                       | View coding profile with language pie chart. Supports time range selection (7d, 30d, 6m, 1y, all). |
| `/rank [range]`                                 | Rank all registered users by total coding time with a paginated leaderboard and chart.             |
| `/compare <user1> <user2>`                      | Compare coding stats between two users side-by-side.                                               |
| `/toplangs`                                     | Show the top programming languages across all registered users (stacked bar chart).                |
| `/languagestats <language>`                     | Get stats for a specific programming language across all users.                                    |
| `/project <user>`                               | Get project breakdown for a user with a pie chart.                                                 |
| `/goals`                                        | View your WakaTime goals and progress with visual bars.                                            |
| `/digest <channel> <time> [timezone] [disable]` | Configure the daily coding digest for this server (requires Manage Server permission).             |
| `/all-time-since-today`                         | Get total time logged on WakaTime since account creation.                                          |
| `/revoke`                                       | Learn how to revoke WakaTime authorization.                                                        |
| `/help`                                         | Display help information about the bot.                                                            |

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

> **Prerequisite:** A PostgreSQL instance must be accessible. You can use a hosted database, run one locally on the host, or extend the `docker-compose.yml` to include a Postgres service.

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your values (DATABASE_URL must point to an accessible PostgreSQL instance)

# 2. Start the bot (builds and runs in container)
docker compose up -d
```

The Docker setup will:

- Build the TypeScript source into `dist/`
- Generate the Prisma client
- Run database migrations on startup (`npx prisma migrate deploy`)
- Persist the encryption salt via a mounted volume (`salt.txt`)

> **Note:** The default `docker-compose.yml` does not include a PostgreSQL service. Add one or use an external database (e.g., hosted on Railway, Render, or a local instance reachable from the container).

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable            | Required | Description                                                                                                                                                              |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BOT_TOKEN`         | Yes      | Your Discord bot token from the [Developer Portal](https://discord.com/developers/applications).                                                                         |
| `GUILD_ID`          | Yes\*    | The Discord server (guild) ID to register commands on. Remove for global commands.                                                                                       |
| `DATABASE_URL`      | Yes      | PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/wakatime-bot?schema=public`).                                                                 |
| `API_URL`           | Yes      | Public URL of your OAuth redirect API (e.g., `https://your-domain.com` or `http://localhost:3000`).                                                                      |
| `API_PORT`          | No       | Port for the OAuth redirect API server (default: `3000`).                                                                                                                |
| `CLIENT_ID`         | Yes      | Your WakaTime OAuth App client ID (from [WakaTime Apps](https://wakatime.com/apps)).                                                                                     |
| `CLIENT_SECRET`     | Yes      | Your WakaTime OAuth App client secret.                                                                                                                                   |
| `WAKATIME_BASE_URL` | No       | Base URL for the WakaTime API (default: `https://wakatime.com`). Useful for self-hosted WakaTime-compatible instances like [Hakatime](https://github.com/mujx/hakatime). |
| `CRYPTO_PASSWORD`   | Yes      | Password used to derive encryption keys via Argon2id for token storage. Choose a strong, random password.                                                                |

> **\*** `GUILD_ID` is required if you want the bot to work in a specific server. Remove it from `.env` to register commands globally (may take up to 1 hour to propagate).

## Architecture

```
┌─────────────────┐       ┌───────────────────────────┐       ┌─────────────────┐
│   Discord API   │◄─────►│     Discord Bot (src)      │──────►│   WakaTime API  │
└─────────────────┘       │                           │       └─────────────────┘
                           │  ┌─────────────────────┐  │              ▲
                           │  │    Slash Commands    │  │              │
                           │  │  • profile [range]   │  │   OAuth2     │
                           │  │  • rank [range]      │  │   Bearer     │
                           │  │  • compare u1 u2     │  │   Token      │
                           │  │  • toplangs          │  │              │
                           │  │  • languagestats     │  │              │
                           │  │  • project           │  │              │
                           │  │  • goals             │  │              │
                           │  │  • digest            │  │              │
                           │  │  • all-time-since-   │  │              │
                           │  │    today             │  │              │
                           │  │  • authorize         │  │              │
                           │  │  • revoke            │  │              │
                           │  │  • help              │  │              │
                           │  └──────────┬──────────┘  │              │
                           │             │              │              │
                           │  ┌──────────▼──────────┐  │              │
                           │  │     Event System     │  │              │
                           │  │  • interactionCreate │  │              │
                           │  │  • ready             │  │              │
                           │  └─────────────────────┘  │              │
                           │                           │              │
                           │  ┌─────────────────────┐  │              │
                           │  │  Digest Scheduler    │  │              │
                           │  │  • cron-based        │  │              │
                           │  │  • daily summary     │  │              │
                           │  │  • user rankings     │  │              │
                           │  └─────────────────────┘  │              │
                           └───────────────────────────┘              │
                                       │                               │
                                       ▼                               │
                           ┌──────────────────────────┐               │
                           │    Express OAuth API      │───────────────┘
                           │    GET /redirect           │  Exchanges auth
                           │                           │  code for tokens
                           └──────────────────────────┘
                                       │
                                       ▼
                           ┌──────────────────────────┐
                           │   PostgreSQL (Prisma)     │
                           │   • User (encrypted      │
                           │     tokens)               │
                           │   • DigestConfig          │
                           │   • GoalRole              │
                           └──────────────────────────┘
```

### Key Directories

| Path             | Description                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| `src/index.ts`   | Application entry point — initializes bot, API, crypto, digest scheduler        |
| `src/structure/` | Core classes: `Client`, `Command`, `Event`                                      |
| `src/commands/`  | Slash command implementations (12 commands)                                     |
| `src/events/`    | Discord event handlers (`interactionCreate` with rank pagination, `ready`)      |
| `src/api/`       | Express OAuth redirect server                                                   |
| `src/services/`  | Background services (daily digest scheduler via node-cron)                      |
| `src/wakatime/`  | WakaTime API client and HTTP response codes                                     |
| `src/db/`        | Prisma database client and user model                                           |
| `src/utils/`     | Crypto (libsodium encryption), embed helpers, and chart generation (QuickChart) |
| `src/types/`     | TypeScript type definitions (WakaTime API models, core types, goals)            |
| `prisma/`        | Prisma schema and migrations (`User`, `DigestConfig`, `GoalRole`)               |

## Scripts

| Script               | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm start`          | Run with `ts-node` (production-like)             |
| `npm run start:dev`  | Run with `ts-node-dev` (auto-restart on changes) |
| `npm run start:prod` | Run compiled JS from `dist/`                     |
| `npm run build`      | Compile TypeScript to `dist/`                    |
| `npm run watch`      | Watch mode — recompile on changes                |

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Discord Library:** [discord.js](https://discord.js.org/) v14
- **Database:** PostgreSQL + [Prisma ORM](https://www.prisma.io/)
- **OAuth API:** [Express](https://expressjs.com/)
- **Encryption:** [libsodium-wrappers-sumo](https://github.com/jedisct1/libsodium.js) (NaCl secretbox + Argon2id key derivation)
- **Charts:** [QuickChart](https://quickchart.io/) (pie and bar charts via `quickchart-js`)
- **Scheduling:** [node-cron](https://github.com/node-cron/node-cron) (daily digest)
- **Color Utility:** [color-util-nodejs](https://www.npmjs.com/package/color-util-nodejs)
- **HTTP Client:** [Axios](https://axios-http.com/)
- **Logging:** [tslog](https://tslog.js.org/)

## License

This project is licensed under the MIT License — see the [LICENCE](LICENCE) file for details.

## Bugs or Feature Requests?

If you find a bug or have a suggestion, please open an issue on the [GitHub repository](https://github.com/zFl4wless/wakatime-discord-bot/issues).
