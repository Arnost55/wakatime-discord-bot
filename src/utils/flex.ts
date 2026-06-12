import { client } from '..';
import { EmbedBuilder, AttachmentBuilder, TextChannel } from 'discord.js';

/**
 * Post an embed and optional attachments to the configured flex channel.
 *
 * Reads `FLEX_CHANNEL_ID` from environment variables. If not configured,
 * this function is a no-op. The embed footer is updated to show who
 * requested the flex post.
 *
 * @param embed - The embed to repost (footer will be overwritten)
 * @param files - Optional attachment files to include
 * @param authorTag - Discord tag of the user who triggered the post
 */
export async function sendFlex(
    embed: EmbedBuilder,
    files: AttachmentBuilder[] | undefined,
    authorTag: string,
) {
    const channelId = process.env.FLEX_CHANNEL_ID;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) return;

        const flexEmbed = EmbedBuilder.from(embed)
            .setFooter({ text: `Requested by ${authorTag}` });

        await (channel as TextChannel).send({
            embeds: [flexEmbed],
            files,
        });
    } catch (error) {
        console.log('Failed to send flex message:', error);
    }
}
