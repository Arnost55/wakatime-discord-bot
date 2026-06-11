import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { Command } from '../../structure/Command';
import { ButtonStyle } from 'discord.js';
import sodium from 'libsodium-wrappers-sumo';
import { userStates } from '../../api';
import { defaultEmbed } from '../../utils/embeds';
import { MessageFlags } from "discord.js";

/**
 * This command is used to authenticate the user through the official WakaTime website.
 */
export default new Command({
    name: 'authorize',
    description: 'Authorize this app through the official WakaTime website.',
    run: async ({ interaction }) => {
        const state = sodium.randombytes_buf(32, 'hex');
        userStates.set(state, interaction.user.id);

        const authorizeQueryParams = {
            client_id: process.env.CLIENT_ID,
            redirect_uri: `${process.env.API_URL}/redirect`,
            response_type: 'code',
            scope: 'email,read_logged_time,read_stats',
            state: state,
        };

        const embed = defaultEmbed()
            .setTitle('Authorize')
            .setDescription('Click the button below to authorize this app through the official WakaTime website.');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Login')
                .setURL(`${process.env.WAKATIME_BASE_URL || 'https://wakatime.com'}/oauth/authorize?${new URLSearchParams(authorizeQueryParams)}`),
        );

        await interaction.reply({
            embeds: [embed],
            components: [buttons as any],
            flags: MessageFlags.Ephemeral,
        });
    },
});
