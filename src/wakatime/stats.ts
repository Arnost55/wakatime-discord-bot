import axios from 'axios';
import { getUserById } from '../db/user/user.model';
import { decrypt } from '../utils/crypto';
import { keys } from '..';
import { StatsResponse, StatsData } from '../types/wakatime/stats.types';

export const TIME_RANGES = ['last_7_days', 'last_30_days', 'last_6_months', 'last_year', 'all_time'] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

const BASE_URL = `${process.env.WAKATIME_BASE_URL || 'https://wakatime.com'}/api/v1`;

export async function fetchStats(username: string): Promise<StatsData> {
    const response = await axios<StatsResponse>(`${BASE_URL}/users/${username}/stats`);
    return response.data.data;
}

export async function fetchStatsWithRange(
    userId: string,
    wakaUserId: string,
    range: TimeRange,
): Promise<StatsData> {
    const user = await getUserById(userId);
    if (!user?.accessToken) throw new Error('No access token');

    const [nonce, chiperText] = user.accessToken.split('$');
    const token = decrypt(chiperText, nonce, keys);

    const response = await axios<StatsResponse>(`${BASE_URL}/users/${wakaUserId}/stats/${range}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
}
