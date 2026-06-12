import { Command } from '../structure/Command';
import axios from 'axios';
import { resolveAccount } from '../utils/resolve-account';
import { generatePieChart } from '../utils/graphs';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { sendFlex } from '../utils/flex';
import { StatsResponse } from '../types/wakatime/stats.types';
import { MessageFlags, AttachmentBuilder } from 'discord.js';

export default new Command({
    name: 'project',
    description: 'See a user\'s project time breakdown.',
    options: [
        {
            name: 'user',
            description: 'The user to look up.',
            type: 6,
            required: true,
        },
    ],
    run: async ({ interaction, args }) => {
        const targetUser = args.getUser('user', true);

        const account = await resolveAccount(targetUser.id);
        if (!account?.wakaUsername) {
            return interaction.reply({
                embeds: [errorEmbed('Not Registered', `${targetUser.username} has no account linked.`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const response = await axios<StatsResponse>(`${account.apiBaseUrl}/api/v1/users/${account.wakaUsername}/stats`);
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

            const embedUrls = account.embedUrls as Record<string, string> | null;
            const embedChartUrl = embedUrls?.projects;

            const embed = defaultEmbed()
                .setTitle(`Projects - ${targetUser.username}${account.name !== 'default' ? ` (${account.name})` : ''}`)
                .setFields(fields);

            let attachment: AttachmentBuilder | undefined;
            if (embedChartUrl) {
                embed.setImage(embedChartUrl);
            } else {
                const points = projects.map((p) => ({ label: p.name, value: p.total_seconds }));
                const chartBuffer = await generatePieChart(points);
                attachment = new AttachmentBuilder(chartBuffer, { name: 'projects.png' });
                embed.setImage('attachment://projects.png');
            }

            await interaction.editReply({
                embeds: [embed],
                files: attachment ? [attachment] : undefined,
            });

            await sendFlex(embed, attachment ? [attachment] : undefined, interaction.user.tag);
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch project data.')],
            });
        }
    },
});
