const BUILT_IN_FORKS: Record<string, string> = {
    wakatime: 'https://wakatime.com',
};

export function resolveForkUrl(input: string): string {
    if (input.startsWith('http://') || input.startsWith('https://')) {
        return input;
    }

    const lower = input.toLowerCase();
    if (BUILT_IN_FORKS[lower]) {
        return BUILT_IN_FORKS[lower];
    }

    const envKey = `WAKATIME_FORK_${input.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
    const envUrl = process.env[envKey];
    if (envUrl) {
        return envUrl;
    }

    return input;
}

export function resolveClientCredentials(
    forkIdentifier: string,
): { clientId: string; clientSecret: string } {
    if (forkIdentifier.startsWith('http://') || forkIdentifier.startsWith('https://')) {
        return {
            clientId: process.env.CLIENT_ID || '',
            clientSecret: process.env.CLIENT_SECRET || '',
        };
    }

    const key = forkIdentifier.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const forkClientId = process.env[`WAKATIME_FORK_${key}_CLIENT_ID`];
    const forkClientSecret = process.env[`WAKATIME_FORK_${key}_CLIENT_SECRET`];

    return {
        clientId: forkClientId || process.env.CLIENT_ID || '',
        clientSecret: forkClientSecret || process.env.CLIENT_SECRET || '',
    };
}

export function getKnownForkNames(): string[] {
    const names = [...Object.keys(BUILT_IN_FORKS)];
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('WAKATIME_FORK_') && !key.endsWith('_CLIENT_ID') && !key.endsWith('_CLIENT_SECRET')) {
            names.push(key.replace('WAKATIME_FORK_', '').toLowerCase());
        }
    }
    return [...new Set(names)];
}
