import express from 'express';
import axios from 'axios';
import qs from 'qs';
import { encrypt, formatNonceAndChiperText } from '../utils/crypto';
import { keys } from '..';
import { upsertAccount } from '../db/account/account.model';
import { isUser, saveUser, updateUser } from '../db/user/user.model';

export type OAuthState = {
    discordUserId: string;
    apiBaseUrl: string;
    accountName: string;
    clientId: string;
    clientSecret: string;
};

export const userStates = new Map<string, OAuthState>();

const app = express();

function parseTokenResponse(data: any, contentType: string): Record<string, string> {
    if (contentType.includes('json')) {
        const json = typeof data === 'string' ? JSON.parse(data) : data;
        const result: Record<string, string> = {};
        for (const key of Object.keys(json)) {
            result[key] = String(json[key]);
        }
        return result;
    }
    return qs.parse(data) as Record<string, string>;
}

function parseErrorResponse(data: any, contentType: string): { error?: string; error_description?: string } {
    if (contentType.includes('json')) {
        const json = typeof data === 'string' ? JSON.parse(data) : data;
        return { error: json.error, error_description: json.error_description };
    }
    return qs.parse(data) as { error?: string; error_description?: string };
}

async function fetchUserInfo(apiBaseUrl: string, accessToken: string): Promise<{ username?: string; userId?: string }> {
    const endpoints = [
        { url: `${apiBaseUrl}/api/v1/users/current`, usernamePath: 'data.username', userIdPath: 'data.id' },
        { url: `${apiBaseUrl}/api/v1/authenticated/me`, usernamePath: 'github_username', userIdPath: 'id' },
    ];

    for (const { url, usernamePath, userIdPath } of endpoints) {
        try {
            const response = await axios(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 5000,
            });
            const data = response.data;
            const getNested = (obj: any, path: string) => path.split('.').reduce((o, k) => o?.[k], obj);
            const username = getNested(data, usernamePath)?.toString();
            const userId = getNested(data, userIdPath)?.toString();
            if (username || userId) {
                return { username, userId };
            }
        } catch {
            continue;
        }
    }
    return {};
}

app.get('/redirect', async (req, res) => {
    const code = req.query.code;
    try {
        if (!req.query.state) {
            res.send('Error: Missing state parameter - Try requesting a new authentication link.');
            return;
        }
        const stateData = userStates.get(req.query.state.toString());
        if (!stateData) {
            res.send('Error: Invalid state - Try requesting a new authentication link.');
            return;
        }

        const { discordUserId, apiBaseUrl, accountName, clientId, clientSecret } = stateData;

        const response = await axios.post(
            `${apiBaseUrl}/oauth/token`,
            qs.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: `${process.env.API_URL}/redirect`,
                grant_type: 'authorization_code',
                code,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );

        const contentType = response.headers['content-type'] || '';
        const tokens = parseTokenResponse(response.data, contentType);
        const accessToken = tokens.access_token;
        if (!accessToken) {
            res.send('Error: No access_token in response.');
            return;
        }

        const { nonce: accessTokenNonce, chiperText: accessTokenChiperText } = encrypt(accessToken, keys);

        let refreshTokenNonce: string | undefined;
        let refreshTokenChiperText: string | undefined;
        if (tokens.refresh_token) {
            const encrypted = encrypt(tokens.refresh_token, keys);
            refreshTokenNonce = encrypted.nonce;
            refreshTokenChiperText = encrypted.chiperText;
        }

        const { username: wakaUsername, userId: wakaUserId } = await fetchUserInfo(apiBaseUrl, accessToken);

        await upsertAccount({
            userId: discordUserId,
            name: accountName,
            apiBaseUrl,
            accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
            refreshToken: refreshTokenNonce && refreshTokenChiperText
                ? formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText)
                : '',
            wakaUsername,
            wakaUserId,
        });

        if (accountName === 'default') {
            const userExists = await isUser(discordUserId);
            const updateData = {
                userId: discordUserId,
                accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
                refreshToken: refreshTokenNonce && refreshTokenChiperText
                    ? formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText)
                    : '',
                wakaUsername,
                wakaUserId,
            };
            if (userExists) {
                await updateUser(updateData);
            } else {
                await saveUser(updateData);
            }
        }

        res.send('Success! You can close this window now.');
    } catch (error: any) {
        console.log(error);
        const contentType = error.response?.headers?.['content-type'] || '';
        const errorData = error.response?.data
            ? parseErrorResponse(error.response.data, contentType)
            : {};
        res.send(`Error: ${errorData.error || 'Unknown'} - ${errorData.error_description || 'Something went wrong.'}`);
    }
});

const port = process.env.API_PORT || 3000;
app.listen(port, () => {
    console.log('API is running on port ' + port);
});
