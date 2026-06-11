import {
    CommandInteractionOptionResolver,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} from 'discord.js';
import { client, logger } from '..';
import { Event } from '../structure/Event';
import { ExtendedInteraction } from '../types/core/Command';

/**
 * Paginated rank data stored per message.
 */
type RankPageState = {
    entries: { username: string; total_seconds: number; human_readable_total: string }[];
    totalPages: number;
    totalHours: number;
    totalMinutes: number;
    range: string;
    chartBuffer: Buffer;
};

const rankPages = new Map<string, RankPageState>();

export function setRankPageData(messageId: string, state: RankPageState) {
    rankPages.set(messageId, state);
}

/**
 * This event is emitted when a command is used.
 */
export default new Event('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            return interaction.reply({ content: 'This command does not exist.', ephemeral: true });
        }

        command.run({
            args: interaction.options as CommandInteractionOptionResolver,
            client,
            interaction: interaction as ExtendedInteraction,
        });
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;
        const messageId = interaction.message.id;

        if (customId.startsWith('rank_')) {
            await interaction.deferUpdate();

            const state = rankPages.get(messageId);
            if (!state) {
                await interaction.followUp({ content: 'Rank data expired. Run `/rank` again.', ephemeral: true });
                return;
            }

            const currentPage = parseInt(customId.split(':')[1] || '0', 10);
            let newPage = currentPage;

            if (customId.startsWith('rank_first')) newPage = 0;
            else if (customId.startsWith('rank_prev')) newPage = currentPage - 1;
            else if (customId.startsWith('rank_next')) newPage = currentPage + 1;
            else if (customId.startsWith('rank_last')) newPage = state.totalPages - 1;

            newPage = Math.max(0, Math.min(newPage, state.totalPages - 1));

            const pageEntries = state.entries.slice(newPage * 5, (newPage + 1) * 5);

            const fields = pageEntries.map((entry, i) => ({
                name: `#${newPage * 5 + i + 1} - ${entry.username}`,
                value: `\`\`\`${entry.human_readable_total}\`\`\``,
                inline: false,
            }));

            fields.unshift({
                name: 'Total Programming Time',
                value: `\`\`\`${state.totalHours} hrs ${state.totalMinutes} mins\`\`\``,
                inline: false,
            });

            const embed = new EmbedBuilder()
                .setTitle(`User Ranking (${state.range.replace(/_/g, ' ')})`)
                .setFields(fields)
                .setImage('attachment://rank.png')
                .setFooter({ text: `Page ${newPage + 1} of ${state.totalPages}` })
                .setColor('#9B59B6');

            const attachment = new AttachmentBuilder(state.chartBuffer, { name: 'rank.png' });

            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rank_first:${newPage}`)
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage <= 0),
                new ButtonBuilder()
                    .setCustomId(`rank_prev:${newPage}`)
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage <= 0),
                new ButtonBuilder()
                    .setCustomId(`rank_next:${newPage}`)
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage >= state.totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`rank_last:${newPage}`)
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage >= state.totalPages - 1),
            );

            await interaction.editReply({
                embeds: [embed],
                files: [attachment],
                components: [buttons],
            });
        }
    }
});
