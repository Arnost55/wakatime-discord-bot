/**
 * View WakaTime goals and progress for the calling user.
 * Fetches goals from the WakaTime Goals API and renders
 * each enabled goal with a visual progress bar and date range.
 *
 * @see https://wakatime.com/developers#goals
 */

import { Command } from '../structure/Command';
import axios from 'axios';
import { getUserById } from '../db/user/user.model';
import { decrypt } from '../utils/crypto';
import { keys } from '..';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { GoalsResponse } from '../types/wakatime/goals.types';
import { MessageFlags } from 'discord.js';

export default new Command({
    name: 'goals',
    description: 'View your WakaTime goals and progress.',
    run: async ({ interaction }) => {
        const dbUser = await getUserById(interaction.user.id);

        if (!dbUser?.wakaUserId || !dbUser?.accessToken) {
            return interaction.reply({
                embeds: [errorEmbed('Not Authorized', 'You need to authorize first via `/authorize`.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const [nonce, chiperText] = dbUser.accessToken.split('$');
            const token = decrypt(chiperText, nonce, keys);

            const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
            const response = await axios<GoalsResponse>(`${baseUrl}/api/v1/users/${dbUser.wakaUserId}/goals`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const goals = response.data.data;

            if (goals.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('No Goals', 'You have no goals set on WakaTime.')],
                });
            }

            const fields = goals
                .filter((g) => g.is_enabled)
                .map((goal) => {
                    const bar = generateProgressBar(goal.percent_completed, 15);
                    return {
                        name: goal.title || 'Untitled Goal',
                        value: `\`\`\`${bar} ${goal.percent_completed.toFixed(1)}%\`\`\`\n${goal.range.start_text} → ${goal.range.end_text}`,
                        inline: false,
                    };
                });

            await interaction.editReply({
                embeds: [defaultEmbed().setTitle('🎯 WakaTime Goals').setFields(fields)],
            });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch goals. Make sure you have goals set on WakaTime.')],
            });
        }
    },
});

/**
 * Generate a text-based progress bar string.
 * @param percent - Completion percentage (0–100).
 * @param length  - Number of characters in the bar.
 * @returns A string of filled (█) and empty (░) blocks.
 */
function generateProgressBar(percent: number, length: number): string {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
