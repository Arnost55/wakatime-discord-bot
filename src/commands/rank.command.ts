import { Command } from '../structure/Command';
import axios from 'axios';
import { getAllUsers } from '../db/user/user.model';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

export default new Command({
    name: 'rank',
    description: 'Rank all registered users by total coding time.',
    run: async ({ interaction }) => {
        const users = await getAllUsers();

        if (users.length === 0) {
            return interaction.reply({
                embeds: [errorEmbed('No Users', 'No users are registered yet.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
            const statsResults = await Promise.allSettled(
                users.map((u) =>
                    axios<StatsResponse>(`${baseUrl}/api/v1/users/${u.wakaUsername}/stats`).then((r) => ({
                        username: u.wakaUsername!,
                        data: r.data.data,
                    })),
                ),
            );

            const entries: { username: string; total_seconds: number; human_readable_total: string }[] = [];

            for (const result of statsResults) {
                if (result.status === 'fulfilled') {
                    entries.push({
                        username: result.value.username,
                        total_seconds: result.value.data.total_seconds,
                        human_readable_total: result.value.data.human_readable_total,
                    });
                }
            }

            if (entries.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('No Data', 'Could not fetch stats for any user.')],
                });
            }

            entries.sort((a, b) => b.total_seconds - a.total_seconds);

            const totalSeconds = entries.reduce((s, e) => s + e.total_seconds, 0);
            const totalHours = Math.round(totalSeconds / 3600);
            const totalMinutes = Math.round((totalSeconds % 3600) / 60);

            const fields = entries.map((entry, i) => ({
                name: `#${i + 1} - ${entry.username}`,
                value: `\`\`\`${entry.human_readable_total}\`\`\``,
                inline: false,
            }));

            fields.unshift({
                name: 'Total Programming Time',
                value: `\`\`\`${totalHours} hrs ${totalMinutes} mins\`\`\``,
                inline: false,
            });

            const points = entries.map((e) => ({ label: e.username, value: e.total_seconds }));
            const chartBuffer = await generatePieChart(points);
            const attachment = new AttachmentBuilder(chartBuffer, { name: 'rank.png' });

            await interaction.editReply({
                embeds: [
                    defaultEmbed()
                        .setTitle('User Ranking')
                        .setFields(fields)
                        .setImage('attachment://rank.png'),
                ],
                files: [attachment],
            });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch ranking data.')],
            });
        }
    },
});
