import { Command } from '../structure/Command';
import axios from 'axios';
import { getUserById, getAllUsers } from '../db/user/user.model';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

/**
 * View a detailed coding profile for yourself or another user.
 * Fetches stats from the WakaTime API and renders a language pie chart.
 *
 * @see https://wakatime.com/developers#stats
 */
export default new Command({
    name: 'profile',
    description: 'Get detailed profile for a WakaTime user with language pie chart.',
    options: [
        {
            name: 'user',
            description: 'The Discord user to look up (leave empty for yourself).',
            type: 6,
            required: false,
        },
    ],
    run: async ({ interaction, args }) => {
        const targetUser = args.getUser('user') || interaction.user;
        const dbUser = await getUserById(targetUser.id);
        const wakaUsername = dbUser?.wakaUsername;

        if (!wakaUsername) {
            const isSelf = targetUser.id === interaction.user.id;
            return interaction.reply({
                embeds: [errorEmbed('Not Registered', isSelf
                    ? 'You haven\'t authorized yet. Use `/authorize` first.'
                    : `${targetUser.username} hasn't authorized yet.`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
            const response = await axios<StatsResponse>(`${baseUrl}/api/v1/users/${wakaUsername}/stats`);
            const data = response.data.data;

            const fields = [
                { name: 'Coding Time', value: `\`\`\`${data.human_readable_total}\`\`\``, inline: true },
                { name: 'Daily Average', value: `\`\`\`${data.human_readable_daily_average}\`\`\``, inline: true },
                { name: 'Range', value: `\`\`\`${data.human_readable_range}\`\`\``, inline: true },
                {
                    name: 'Languages',
                    value: data.languages.slice(0, 8).map((l) => `${l.name} ${l.percent}%`).join(', ') || 'No data',
                    inline: false,
                },
                {
                    name: 'Editors',
                    value: data.editors.slice(0, 5).map((e) => `${e.name} ${e.percent}%`).join(', ') || 'No data',
                    inline: false,
                },
                {
                    name: 'Operating Systems',
                    value: data.operating_systems.slice(0, 5).map((o) => `${o.name} ${o.percent}%`).join(', ') || 'No data',
                    inline: false,
                },
            ];

            const points = data.languages.map((l) => ({ label: l.name, value: l.percent }));
            const chartBuffer = await generatePieChart(points);
            const attachment = new AttachmentBuilder(chartBuffer, { name: 'languages.png' });

            await interaction.editReply({
                embeds: [
                    defaultEmbed()
                        .setTitle(`${targetUser.username}'s Profile`)
                        .setFields(fields)
                        .setImage('attachment://languages.png'),
                ],
                files: [attachment],
            });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch profile data.')],
            });
        }
    },
});
