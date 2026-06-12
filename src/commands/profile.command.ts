import { Command } from '../structure/Command';
import axios from 'axios';
import { getUserById } from '../db/user/user.model';
import { resolveAccount } from '../utils/resolve-account';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

const RANGE_CHOICES = [
    { name: 'Last 7 Days', value: 'last_7_days' },
    { name: 'Last 30 Days', value: 'last_30_days' },
    { name: 'Last 6 Months', value: 'last_6_months' },
    { name: 'Last Year', value: 'last_year' },
    { name: 'All Time', value: 'all_time' },
];

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
        {
            name: 'account',
            description: 'Which account to use (defaults to your default account).',
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
        const targetUser = args.getUser('user') || interaction.user;
        const accountName = args.getString('account');
        const range = args.getString('range') || 'last_7_days';

        const isSelf = targetUser.id === interaction.user.id;
        const lookupUserId = isSelf ? interaction.user.id : targetUser.id;

        const account = await resolveAccount(lookupUserId, accountName);
        if (!account?.wakaUsername) {
            return interaction.reply({
                embeds: [errorEmbed('Not Registered', isSelf
                    ? 'No account found. Use `/authorize` or `/account add` first.'
                    : `${targetUser.username} has no account linked.`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const response = await axios<StatsResponse>(`${account.apiBaseUrl}/api/v1/users/${account.wakaUsername}/stats/${range}`);
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
                        .setTitle(`${targetUser.username}'s Profile (${account.name} · ${range.replace(/_/g, ' ')})`)
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
