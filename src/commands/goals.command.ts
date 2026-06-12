import { Command } from '../structure/Command';
import axios from 'axios';
import { decrypt } from '../utils/crypto';
import { keys } from '..';
import { resolveAccount } from '../utils/resolve-account';
import { defaultEmbed, errorEmbed, loadingEmbed } from '../utils/embeds';
import { GoalsResponse } from '../types/wakatime/goals.types';
import { MessageFlags } from 'discord.js';

export default new Command({
    name: 'goals',
    description: 'View your WakaTime goals and progress.',
    options: [
        {
            name: 'account',
            description: 'Which account to check (defaults to your default).',
            type: 3,
            required: false,
        },
    ],
    run: async ({ interaction, args }) => {
        const accountName = args.getString('account');
        const account = await resolveAccount(interaction.user.id, accountName);

        if (!account?.wakaUserId || !account?.accessToken) {
            return interaction.reply({
                embeds: [errorEmbed('Not Authorized', 'No account found. Use `/authorize` or `/account add` first.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({ embeds: [loadingEmbed()], flags: MessageFlags.Ephemeral });

        try {
            const [nonce, chiperText] = account.accessToken.split('$');
            const token = decrypt(chiperText, nonce, keys);

            const response = await axios<GoalsResponse>(`${account.apiBaseUrl}/api/v1/users/${account.wakaUserId}/goals`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const goals = response.data.data;

            if (goals.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('No Goals', 'You have no goals set on this account.')],
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
                embeds: [defaultEmbed()
                    .setTitle(`Goals - ${account.name}`)
                    .setFields(fields)],
            });
        } catch {
            await interaction.editReply({
                embeds: [errorEmbed('Error', 'Failed to fetch goals.')],
            });
        }
    },
});

function generateProgressBar(percent: number, length: number): string {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
