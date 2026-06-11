import { Command } from '../structure/Command';
import axios from 'axios';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } from 'discord.js';
import { getAllUsers } from '../db/user/user.model';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { setRankPageData } from '../events/interactionCreate.event';

const RANGE_CHOICES = [
    { name: 'Last 7 Days', value: 'last_7_days' },
    { name: 'Last 30 Days', value: 'last_30_days' },
    { name: 'Last 6 Months', value: 'last_6_months' },
    { name: 'Last Year', value: 'last_year' },
    { name: 'All Time', value: 'all_time' },
];

const PAGE_SIZE = 5;

export default new Command({
    name: 'rank',
    description: 'Rank all registered users by total coding time.',
    options: [
        {
            name: 'range',
            description: 'Time range for the stats.',
            type: 3,
            required: false,
            choices: RANGE_CHOICES,
        },
    ],
    run: async ({ interaction, args }) => {
        const range = args.getString('range') || 'last_7_days';
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
                    axios<StatsResponse>(`${baseUrl}/api/v1/users/${u.wakaUsername}/stats/${range}`)
                        .then((r) => ({
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

            const totalPages = Math.ceil(entries.length / PAGE_SIZE);

            const points = entries.map((e) => ({ label: e.username, value: e.total_seconds }));
            const chartBuffer = await generatePieChart(points);

            const firstPage = entries.slice(0, PAGE_SIZE);
            const fields = firstPage.map((entry, i) => ({
                name: `#${i + 1} - ${entry.username}`,
                value: `\`\`\`${entry.human_readable_total}\`\`\``,
                inline: false,
            }));

            fields.unshift({
                name: 'Total Programming Time',
                value: `\`\`\`${totalHours} hrs ${totalMinutes} mins\`\`\``,
                inline: false,
            });

            const embed = defaultEmbed()
                .setTitle(`User Ranking (${range.replace(/_/g, ' ')})`)
                .setFields(fields)
                .setImage('attachment://rank.png')
                .setFooter({ text: `Page 1 of ${totalPages}` });

            const attachment = new AttachmentBuilder(chartBuffer, { name: 'rank.png' });

            const buildButtons = (page: number) =>
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rank_first:${page}`)
                        .setEmoji('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 0),
                    new ButtonBuilder()
                        .setCustomId(`rank_prev:${page}`)
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 0),
                    new ButtonBuilder()
                        .setCustomId(`rank_next:${page}`)
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId(`rank_last:${page}`)
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= totalPages - 1),
                );

            const msg = await interaction.editReply({
                embeds: [embed],
                files: [attachment],
                components: totalPages > 1 ? [buildButtons(0)] : undefined,
            });

            if (totalPages > 1) {
                setRankPageData(msg.id, {
                    entries,
                    totalPages,
                    totalHours,
                    totalMinutes,
                    range,
                    chartBuffer: Buffer.from(chartBuffer),
                });
            }
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch ranking data.')],
            });
        }
    },
});
