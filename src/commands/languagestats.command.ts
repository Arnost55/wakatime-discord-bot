import { Command } from '../structure/Command';
import axios from 'axios';
import { getAllUsers } from '../db/user/user.model';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

export default new Command({
    name: 'languagestats',
    description: 'Get stats about a specific programming language across all registered users.',
    options: [
        {
            name: 'language',
            description: 'The programming language to look up.',
            type: 3,
            required: true,
        },
    ],
    run: async ({ interaction, args }) => {
        const language = args.getString('language', true);
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

            const points: { label: string; value: number }[] = [];
            for (const result of statsResults) {
                if (result.status === 'fulfilled') {
                    const lang = result.value.data.languages.find(
                        (l) => l.name.toLowerCase() === language.toLowerCase(),
                    );
                    if (lang && lang.total_seconds > 0) {
                        points.push({ label: result.value.username, value: lang.total_seconds });
                    }
                }
            }

            if (points.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('Not Found', `No one has used **${language}** yet.`)],
                });
            }

            const totalHours = Math.round(points.reduce((s, p) => s + p.value, 0) / 3600);
            const chartBuffer = await generatePieChart(points);
            const attachment = new AttachmentBuilder(chartBuffer, { name: 'langstats.png' });

            await interaction.editReply({
                embeds: [
                    defaultEmbed()
                        .setTitle(`${language} Stats`)
                        .setDescription(`**${totalHours}** total hours across ${points.length} user(s)`)
                        .setImage('attachment://langstats.png'),
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
