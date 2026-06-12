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

export function getKnownForkNames(): string[] {
    const names = Object.keys(BUILT_IN_FORKS);
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('WAKATIME_FORK_')) {
            names.push(key.replace('WAKATIME_FORK_', '').toLowerCase());
        }
    }
    return names;
}
