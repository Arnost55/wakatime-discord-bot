import express from 'express';
import axios from 'axios';
import qs from 'qs';
import { encrypt, formatNonceAndChiperText } from '../utils/crypto';
import { keys } from '..';
import { upsertAccount, migrateExistingUsersToAccounts } from '../db/account/account.model';
import { isUser, saveUser, updateUser } from '../db/user/user.model';

export type OAuthState = {
    discordUserId: string;
    apiBaseUrl: string;
    accountName: string;
};

export const userStates = new Map<string, OAuthState>();

const app = express();
app.get('/redirect', async (req, res) => {
    const code = req.query.code;
    try {
        const stateData = userStates.get(req.query.state.toString());
        if (!stateData) {
            res.send('Error: Invalid state - Try requesting a new authentication link.');
            return;
        }

        const { discordUserId, apiBaseUrl, accountName } = stateData;

        const response = await axios(`${apiBaseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: qs.stringify({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                redirect_uri: `${process.env.API_URL}/redirect`,
                grant_type: 'authorization_code',
                code,
            }),
        });

        const { access_token, refresh_token } = qs.parse(response.data);
        const { nonce: accessTokenNonce, chiperText: accessTokenChiperText } = encrypt(access_token.toString(), keys);
        const { nonce: refreshTokenNonce, chiperText: refreshTokenChiperText } = encrypt(
            refresh_token.toString(),
            keys,
        );

        let wakaUsername: string | undefined;
        let wakaUserId: string | undefined;
        try {
            const userResponse = await axios(`${apiBaseUrl}/api/v1/users/current`, {
                headers: { Authorization: `Bearer ${access_token}` },
            });
            wakaUsername = userResponse.data?.data?.username;
            wakaUserId = userResponse.data?.data?.id;
        } catch {
            console.log('Failed to fetch WakaTime user info');
        }

        await upsertAccount({
            userId: discordUserId,
            name: accountName,
            apiBaseUrl,
            accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
            refreshToken: formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText),
            wakaUsername,
            wakaUserId,
        });

        if (accountName === 'default') {
            const userExists = await isUser(discordUserId);
            if (userExists) {
                await updateUser({
                    userId: discordUserId,
                    accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
                    refreshToken: formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText),
                    wakaUsername,
                    wakaUserId,
                });
            } else {
                await saveUser({
                    userId: discordUserId,
                    accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
                    refreshToken: formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText),
                    wakaUsername,
                    wakaUserId,
                });
            }
        }

        res.send('Success! You can close this window now.');
    } catch (error) {
        console.log(error);
        const errorData = error.response?.data ? qs.parse(error.response.data) : {};
        res.send(`Error: ${errorData.error || 'Unknown'} - ${errorData.error_description || 'Something went wrong.'}`);
    }
});

const port = process.env.API_PORT || 3000;
app.listen(port, () => {
    console.log('API is running on port ' + port);
});
