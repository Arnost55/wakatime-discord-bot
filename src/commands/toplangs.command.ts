import { Command } from '../structure/Command';
import axios from 'axios';
import { getAllUsers } from '../db/user/user.model';
import { generateBarChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

/**
 * Aggregate and display the top programming languages across all registered users.
 * Renders a stacked bar chart comparing language usage per user.
 *
 * @see https://wakatime.com/developers#stats
 */
export default new Command({
    name: 'toplangs',
    description: 'Get the top languages across all registered users on the server.',
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

            await interaction.editReply({
                embeds: [
                    defaultEmbed()
                        .setTitle('Top Languages')
                        .setFields(fields)
                        .setImage('attachment://toplangs.png'),
                ],
                files: [attachment],
            });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch language stats.')],
            });
        }
    },
});
