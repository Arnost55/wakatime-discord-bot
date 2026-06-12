import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { Command } from '../../structure/Command';
import { ButtonStyle } from 'discord.js';
import sodium from 'libsodium-wrappers-sumo';
import { userStates } from '../../api';
import { defaultEmbed } from '../../utils/embeds';
import { resolveClientCredentials } from '../../utils/resolve-fork';
import { MessageFlags } from "discord.js";

export default new Command({
    name: 'authorize',
    description: 'Link your Hackatime account to the bot.',
    run: async ({ interaction }) => {
        const apiBaseUrl = process.env.WAKATIME_BASE_URL || 'https://hackatime.hackclub.com';
        const { clientId, clientSecret } = resolveClientCredentials(apiBaseUrl);

        const state = sodium.randombytes_buf(32, 'hex');
        userStates.set(state, {
            discordUserId: interaction.user.id,
            apiBaseUrl,
            accountName: 'default',
            clientId,
            clientSecret,
        });

        const authorizeQueryParams = {
            client_id: clientId,
            redirect_uri: `${process.env.API_URL}/redirect`,
            response_type: 'code',
            scope: 'profile read',
            state: state,
        };

        const embed = defaultEmbed()
            .setTitle('Authorize')
            .setDescription('Click below to link your **Hackatime** account.');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Login with Hackatime')
                .setURL(`${apiBaseUrl}/oauth/authorize?${new URLSearchParams(authorizeQueryParams)}`),
        );

        await interaction.reply({
            embeds: [embed],
            components: [buttons as any],
            flags: MessageFlags.Ephemeral,
        });
    },
});
