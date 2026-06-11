import { Command } from '../structure/Command';
import { prismaClient } from '../db/prisma';
import { defaultEmbed, errorEmbed } from '../utils/embeds';
import { reloadDigestScheduler } from '../services/digest';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';

export default new Command({
    name: 'digest',
    description: 'Configure the daily coding digest for this server.',
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    options: [
        {
            name: 'channel',
            description: 'The channel to post the digest in.',
            type: 7,
            required: true,
        },
        {
            name: 'time',
            description: 'Time to post (24h format, e.g. 09:00).',
            type: 3,
            required: true,
        },
        {
            name: 'timezone',
            description: 'Timezone (e.g. UTC, America/New_York, Europe/London).',
            type: 3,
            required: false,
        },
        {
            name: 'disable',
            description: 'Disable the digest.',
            type: 5,
            required: false,
        },
    ],
    run: async ({ interaction, args }) => {
        const channel = args.getChannel('channel', true);
        const time = args.getString('time', true);
        const timezone = args.getString('timezone') || 'UTC';
        const disable = args.getBoolean('disable') || false;

        if (!/^\d{2}:\d{2}$/.test(time)) {
            return interaction.reply({
                embeds: [errorEmbed('Invalid Time', 'Use 24h format like `09:00` or `17:30`.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = interaction.guildId!;

        if (disable) {
            await prismaClient.digestConfig.deleteMany({ where: { guildId } });
            await reloadDigestScheduler();
            return interaction.reply({
                embeds: [defaultEmbed().setTitle('Digest Disabled').setDescription('Daily digest has been turned off.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await prismaClient.digestConfig.upsert({
            where: { guildId },
            update: { channelId: channel.id, time, timezone },
            create: { guildId, channelId: channel.id, time, timezone },
        });

        await reloadDigestScheduler();

        await interaction.reply({
            embeds: [
                defaultEmbed()
                    .setTitle('✅ Digest Configured')
                    .setDescription(`Daily coding digest will be posted to ${channel} at **${time}** ${timezone}.`),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
});
