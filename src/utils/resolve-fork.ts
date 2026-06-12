const BUILT_IN_FORKS: Record<string, string> = {
    wakatime: 'https://wakatime.com',
    hackatime: 'https://hackatime.hackclub.com',
};

/**
 * Resolve a fork name or URL to a full API base URL.
 *
 * Accepts:
 * - A full URL (returned as-is)
 * - A built-in fork name (`wakatime` → `https://wakatime.com`, `hackatime` → `https://hackatime.hackclub.com`)
 * - A custom fork name from `WAKATIME_FORK_<NAME>` env vars
 * - Any other string (returned as-is, assumed to be a URL)
 */
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

/**
 * Resolve OAuth client credentials for a given fork identifier.
 *
 * For named forks, checks `WAKATIME_FORK_<NAME>_CLIENT_ID` and `_CLIENT_SECRET`
 * env vars first, then falls back to the global `CLIENT_ID`/`CLIENT_SECRET`.
 *
 * For full URLs, always uses the global credentials.
 */
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

/**
 * Get all known fork names from built-in entries and `WAKATIME_FORK_*` env vars.
 * Excludes `_CLIENT_ID` and `_CLIENT_SECRET` suffixed variables.
 */
export function getKnownForkNames(): string[] {
    const names = [...Object.keys(BUILT_IN_FORKS)];
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('WAKATIME_FORK_') && !key.endsWith('_CLIENT_ID') && !key.endsWith('_CLIENT_SECRET')) {
            names.push(key.replace('WAKATIME_FORK_', '').toLowerCase());
        }
    }
    return [...new Set(names)];
}
