import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { Command } from '../../structure/Command';
import { ButtonStyle } from 'discord.js';
import sodium from 'libsodium-wrappers-sumo';
import { userStates } from '../../api';
import { defaultEmbed } from '../../utils/embeds';
import { resolveForkUrl } from '../../utils/resolve-fork';
import { MessageFlags } from "discord.js";

export default new Command({
    name: 'authorize',
    description: 'Authorize this app through a WakaTime-compatible API.',
    options: [
        {
            name: 'name',
            description: 'Name for this account (default: "default").',
            type: 3,
            required: false,
        },
        {
            name: 'url',
            description: 'API base URL or fork name (e.g. "hakatime"). Defaults to WAKATIME_BASE_URL.',
            type: 3,
            required: false,
        },
    ],
    run: async ({ interaction, args }) => {
        const accountName = args.getString('name') || 'default';
        const rawUrl = args.getString('url') || process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
        const apiBaseUrl = resolveForkUrl(rawUrl);

        const state = sodium.randombytes_buf(32, 'hex');
        userStates.set(state, {
            discordUserId: interaction.user.id,
            apiBaseUrl,
            accountName,
        });

        const authorizeQueryParams = {
            client_id: process.env.CLIENT_ID,
            redirect_uri: `${process.env.API_URL}/redirect`,
            response_type: 'code',
            scope: 'email,read_logged_time,read_stats',
            state: state,
        };

        const embed = defaultEmbed()
            .setTitle('Authorize')
            .setDescription(`Click below to authorize **${accountName}** on **${apiBaseUrl}**.`);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Login')
                .setURL(`${apiBaseUrl}/oauth/authorize?${new URLSearchParams(authorizeQueryParams)}`),
        );

        await interaction.reply({
            embeds: [embed],
            components: [buttons as any],
            flags: MessageFlags.Ephemeral,
        });
    },
});
