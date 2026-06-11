import axios from 'axios';
import { getUserById } from '../db/user/user.model';
import { keys } from '..';
import { decrypt } from '../utils/crypto';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { HttpResponseCode } from './http-response-code';
import { ExtendedInteraction } from '../types/core/Command';
import { MessageFlags } from 'discord.js';

const BASE_URL = `${process.env.WAKATIME_BASE_URL || 'https://wakatime.com'}/api/v1`;

/**
 * Gets data from the WakaTime API and sends it to the user.
 *
 * @param title The title of the embed.
 * @param description The description of the embed.
 * @param endpoint The endpoint to call.
 * @param userId The ID of the user that called the command.
 * @param interaction The interaction to reply to.
 * @param formatResponse The function to format the response.
 */
type Request = {
    title: string;
    description: string;
    thumbnailKey?: string;
    endpoint: string;
    params?: Record<string, any>;
    userId: string;
    interaction: ExtendedInteraction;
    formatResponse: (response: any) => any;
};
export default async function request<T>(requestOptions: Request): Promise<void> {
    const { title, description, thumbnailKey, endpoint, params, userId, interaction, formatResponse } = requestOptions;
    await interaction.reply({
        embeds: [loadingEmbed()],
        flags: MessageFlags.Ephemeral,
    });

    try {
        const accessToken = await getAccessToken(userId);
        const response = await axios(`${BASE_URL}/${endpoint}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: params,
        });
        const data = response.data.data as T;

        await interaction.editReply({
            embeds: [getEmbedFromData(title, description, formatResponse(data), data[thumbnailKey])],
        });
    } catch (error) {
        if (error.response && error.response.status in HttpResponseCode) {
            const { code, status, message } = HttpResponseCode[error.response.status];
            await interaction.editReply({
                embeds: [errorEmbed(`${code} ${status}`, message)],
            });
            return;
        }

        console.log(error);

        await interaction.editReply({
            embeds: [errorEmbed('Unknown Error', 'Please contact the developer. (See `/help`)')],
        });
    }
}

/**
 * Gets the access token of a user.
 *
 * @param userId The ID of the user to get the access token from.
 * @returns The access token of the user.
 */
async function getAccessToken(userId: string): Promise<string | null> {
    const user = await getUserById(userId);
    if (!user) return null;

    const [nonce, chiperText] = user.accessToken.split('$');

    return decrypt(chiperText, nonce, keys);
}

/**
 * Creates an embed from the data returned from the WakaTime API.
 *
 * @param title The title of the embed.
 * @param description The description of the embed.
 * @param data The data to put in the embed.
 * @param thumbnailUrl The URL of the thumbnail.
 * @returns The created embed.
 */
const getEmbedFromData = (title: string, description: string, data: any, thumbnailUrl?: string) =>
    defaultEmbed()
        .setTitle(title)
        .setDescription(`*${description}*`)
        .setThumbnail(thumbnailUrl)
        .addFields(
            Object.keys(data).map((key) => {
                const value = data[key];

                return {
                    name: key,
                    value: `\`\`\`${value}\`\`\``,
                    inline: true,
                };
            }),
        );
