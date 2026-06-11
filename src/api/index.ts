import express from 'express';
import axios from 'axios';
import qs from 'qs';
import { encrypt, formatNonceAndChiperText } from '../utils/crypto';
import { keys } from '..';
import { isUser, saveUser, updateUser } from '../db/user/user.model';

export const userStates = new Map<string, string>();

const app = express();
app.get('/redirect', async (req, res) => {
    const code = req.query.code;
    try {
        const response = await axios(`${process.env.WAKATIME_BASE_URL || 'https://wakatime.com'}/oauth/token`, {
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

        const userId = userStates.get(req.query.state.toString());
        if (!userId) {
            res.send('Error: Invalid state - Try requesting a new authentication link.');
            return;
        }

        const { access_token, refresh_token } = qs.parse(response.data);
        const { nonce: accessTokenNonce, chiperText: accessTokenChiperText } = encrypt(access_token.toString(), keys);
        const { nonce: refreshTokenNonce, chiperText: refreshTokenChiperText } = encrypt(
            refresh_token.toString(),
            keys,
        );

        let wakaUsername: string | undefined;
        let wakaUserId: string | undefined;
        try {
            const userResponse = await axios(`${process.env.WAKATIME_BASE_URL || 'https://wakatime.com'}/api/v1/users/current`, {
                headers: { Authorization: `Bearer ${access_token}` },
            });
            wakaUsername = userResponse.data?.data?.username;
            wakaUserId = userResponse.data?.data?.id;
        } catch {
            console.log('Failed to fetch WakaTime user info');
        }

        const userExists = await isUser(userId);
        if (userExists) {
            await updateUser({
                userId: userId,
                accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
                refreshToken: formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText),
                wakaUsername,
                wakaUserId,
            });
        } else {
            await saveUser({
                userId: userId,
                accessToken: formatNonceAndChiperText(accessTokenNonce, accessTokenChiperText),
                refreshToken: formatNonceAndChiperText(refreshTokenNonce, refreshTokenChiperText),
                wakaUsername,
                wakaUserId,
            });
        }

        res.send('Success! You can close this window now.');
    } catch (error) {
        console.log(error);
        const errorData = qs.parse(error.response.data);

        res.send(`Error: ${errorData.error} - ${errorData.error_description}`);
    }
});

const port = process.env.API_PORT || 3000;
app.listen(port, () => {
    console.log('API is running on port ' + port);
});
