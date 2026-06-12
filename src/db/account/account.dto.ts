export type AccountDto = {
    userId: string;
    name: string;
    apiBaseUrl: string;
    accessToken: string;
    refreshToken: string;
    wakaUsername?: string;
    wakaUserId?: string;
    embedUrls?: Record<string, string>;
};

export type EmbedChartType = 'languages' | 'projects';
