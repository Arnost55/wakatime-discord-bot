import { Command } from '../structure/Command';
import axios from 'axios';
import { prismaClient } from '../db/prisma';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { sendFlex } from '../utils/flex';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

export default new Command({
    name: 'languagestats',
    description: 'See which users have used a specific language.',
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

            const embed = defaultEmbed()
                .setTitle(`${language} Stats`)
                .setDescription(`**${totalHours}** total hours across ${points.length} user(s)`)
                .setImage('attachment://langstats.png');

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
