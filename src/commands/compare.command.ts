/**
 * Compare coding stats between two users side-by-side.
 * Fetches stats for both users from the WakaTime API and displays
 * total time, daily average, and per-language percentage comparison.
 *
 * @see https://wakatime.com/developers#stats
 */

import { Command } from '../structure/Command';
import axios from 'axios';
import { getUserById } from '../db/user/user.model';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags } from 'discord.js';

export default new Command({
    name: 'compare',
    description: 'Compare coding stats between two users.',
    options: [
        {
            name: 'user1',
            description: 'First user to compare.',
            type: 6,
            required: true,
        },
        {
            name: 'user2',
            description: 'Second user to compare.',
            type: 6,
            required: true,
        },
    ],
    run: async ({ interaction, args }) => {
        const user1 = args.getUser('user1', true);
        const user2 = args.getUser('user2', true);
        const db1 = await getUserById(user1.id);
        const db2 = await getUserById(user2.id);

        if (!db1?.wakaUsername || !db2?.wakaUsername) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        'Not Registered',
                        `${!db1?.wakaUsername ? user1.username : user2.username} hasn't authorized yet.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
            const [r1, r2] = await Promise.all([
                axios<StatsResponse>(`${baseUrl}/api/v1/users/${db1.wakaUsername}/stats`),
                axios<StatsResponse>(`${baseUrl}/api/v1/users/${db2.wakaUsername}/stats`),
            ]);

            const d1 = r1.data.data;
            const d2 = r2.data.data;

            const langMap = new Map<string, [number, number]>();
            for (const l of d1.languages) langMap.set(l.name, [l.percent, 0]);
            for (const l of d2.languages) {
                const existing = langMap.get(l.name);
                if (existing) existing[1] = l.percent;
                else langMap.set(l.name, [0, l.percent]);
            }

            const topLangs = [...langMap.entries()]
                .sort((a, b) => Math.max(b[1][0], b[1][1]) - Math.max(a[1][0], a[1][1]))
                .slice(0, 8);

            const embed = defaultEmbed()
                .setTitle('Compare Coding Stats')
                .addFields(
                    {
                        name: `${user1.username}`,
                        value: `\`\`\`${d1.human_readable_total}\nDaily: ${d1.human_readable_daily_average}\`\`\``,
                        inline: true,
                    },
                    {
                        name: `${user2.username}`,
                        value: `\`\`\`${d2.human_readable_total}\nDaily: ${d2.human_readable_daily_average}\`\`\``,
                        inline: true,
                    },
                    { name: '\u200b', value: '\u200b', inline: true },
                    ...topLangs.map(([name, [p1, p2]]) => ({
                        name,
                        value: `\`\`\`${p1.toFixed(1)}% vs ${p2.toFixed(1)}%\`\`\``,
                        inline: true,
                    })),
                );

            await interaction.editReply({ embeds: [embed] });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch comparison data.')],
            });
        }
    },
});
