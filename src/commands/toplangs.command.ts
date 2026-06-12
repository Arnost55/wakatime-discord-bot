import { Command } from '../structure/Command';
import axios from 'axios';
import { prismaClient } from '../db/prisma';
import { generateBarChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { sendFlex } from '../utils/flex';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

export default new Command({
    name: 'toplangs',
    description: 'See the most popular languages across all users.',
    run: async ({ interaction }) => {
        const accounts = await prismaClient.wakaAccount.findMany({ where: { wakaUsername: { not: null } } });

        if (accounts.length === 0) {
            return interaction.reply({
                embeds: [errorEmbed('No Users', 'No accounts found.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const statsResults = await Promise.allSettled(
                accounts.map((a) =>
                    axios<StatsResponse>(`${a.apiBaseUrl}/api/v1/users/${a.wakaUsername}/stats`).then((r) => ({
                        username: `${a.wakaUsername} (${a.name})`,
                        data: r.data.data,
                    })),
                ),
            );

            const langTotals: Record<string, number> = {};
            const userLangs: Record<string, Record<string, number>> = {};

            for (const result of statsResults) {
                if (result.status === 'fulfilled') {
                    const { username, data } = result.value;
                    userLangs[username] = {};
                    for (const lang of data.languages) {
                        langTotals[lang.name] = (langTotals[lang.name] || 0) + lang.total_seconds;
                        userLangs[username][lang.name] = lang.total_seconds;
                    }
                }
            }

            const topLanguages = Object.entries(langTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([name]) => name);

            if (topLanguages.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('No Data', 'No language data found.')],
                });
            }

            const datasets = Object.entries(userLangs).map(([username, langs]) => ({
                label: username,
                data: topLanguages.map((lang) => Math.round((langs[lang] || 0) / 3600)),
            }));

            const fields = topLanguages.map((lang, i) => ({
                name: `#${i + 1} ${lang}`,
                value: Object.entries(userLangs)
                    .filter(([, langs]) => langs[lang])
                    .sort((a, b) => (b[1][lang] || 0) - (a[1][lang] || 0))
                    .map(([username, langs]) => `${username} ${Math.round((langs[lang] || 0) / 3600)}h`)
                    .join('\n') || 'No data',
                inline: true,
            }));

            const chartBuffer = await generateBarChart(topLanguages, datasets);
            const attachment = new AttachmentBuilder(chartBuffer, { name: 'toplangs.png' });

            const embed = defaultEmbed()
                .setTitle('Top Languages')
                .setFields(fields)
                .setImage('attachment://toplangs.png');

            await interaction.editReply({
                embeds: [embed],
                files: [attachment],
            });

            await sendFlex(embed, [attachment], interaction.user.tag);
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch language stats.')],
            });
        }
    },
});
