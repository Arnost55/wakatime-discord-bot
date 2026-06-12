import { Command } from '../structure/Command';
import axios from 'axios';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } from 'discord.js';
import { prismaClient } from '../db/prisma';
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
    description: 'Rank users by coding time on a specific instance.',
    options: [
        {
            name: 'instance',
            description: 'API base URL to filter by (optional).',
            type: 3,
            required: false,
        },
        {
            name: 'range',
            description: 'Time range for the stats.',
            type: 3,
            required: false,
            choices: RANGE_CHOICES,
        },
    ],
    run: async ({ interaction, args }) => {
        const instanceFilter = args.getString('instance');
        const range = args.getString('range') || 'last_7_days';

        const allAccounts = instanceFilter
            ? await prismaClient.wakaAccount.findMany({ where: { apiBaseUrl: instanceFilter, wakaUsername: { not: null } } })
            : await prismaClient.wakaAccount.findMany({ where: { wakaUsername: { not: null } } });

        if (allAccounts.length === 0) {
            return interaction.reply({
                embeds: [errorEmbed('No Users', 'No accounts found.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const statsResults = await Promise.allSettled(
                allAccounts.map((a) =>
                    axios<StatsResponse>(`${a.apiBaseUrl}/api/v1/users/${a.wakaUsername}/stats/${range}`)
                        .then((r) => ({
                            username: `${a.wakaUsername} (${a.name})`,
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
                    embeds: [errorEmbed('No Data', 'Could not fetch stats.')],
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

            const title = instanceFilter
                ? `User Ranking (${instanceFilter} · ${range.replace(/_/g, ' ')})`
                : `User Ranking (${range.replace(/_/g, ' ')})`;

            const embed = defaultEmbed()
                .setTitle(title)
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
