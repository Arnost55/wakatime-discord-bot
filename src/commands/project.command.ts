import { Command } from '../structure/Command';
import axios from 'axios';
import { getUserById } from '../db/user/user.model';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

export default new Command({
    name: 'project',
    description: 'Get project stats for a user.',
    options: [
        {
            name: 'user',
            description: 'The Discord user to look up.',
            type: 6,
            required: true,
        },
    ],
    run: async ({ interaction, args }) => {
        const targetUser = args.getUser('user', true);
        const dbUser = await getUserById(targetUser.id);
        const wakaUsername = dbUser?.wakaUsername;

        if (!wakaUsername) {
            return interaction.reply({
                embeds: [errorEmbed('Not Registered', `${targetUser.username} hasn't authorized yet.`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
            const response = await axios<StatsResponse>(`${baseUrl}/api/v1/users/${wakaUsername}/stats`);
            const projects = response.data.data.projects
                .sort((a, b) => b.total_seconds - a.total_seconds)
                .slice(0, 15);

            if (projects.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('No Projects', 'No project data found.')],
                });
            }

            const fields = projects.slice(0, 10).map((p, i) => ({
                name: `#${i + 1} ${p.name}`,
                value: `\`\`\`${p.text}\`\`\``,
                inline: true,
            }));

            const points = projects.map((p) => ({ label: p.name, value: p.total_seconds }));
            const chartBuffer = await generatePieChart(points);
            const attachment = new AttachmentBuilder(chartBuffer, { name: 'projects.png' });

            await interaction.editReply({
                embeds: [
                    defaultEmbed()
                        .setTitle(`Projects - ${targetUser.username}`)
                        .setFields(fields)
                        .setImage('attachment://projects.png'),
                ],
                files: [attachment],
            });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch project data.')],
            });
        }
    },
});
