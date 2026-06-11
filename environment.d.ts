declare global {
    namespace NodeJS {
        interface ProcessEnv {
            // Bot
            BOT_TOKEN: string;
            GUILD_ID: string;

            // API
            API_URL: string;
            API_PORT: number;

            // Database
            DATABASE_URL: string;

            // WakaTime
            CLIENT_ID: string;
            CLIENT_SECRET: string;
            WAKATIME_BASE_URL?: string;

            // Crypto
            CRYPTO_PASSWORD: string;
        }
    }
}

export {};
