import { Command } from '../structure/Command';
import { defaultEmbed } from '../utils/embeds';
import { MessageFlags } from 'discord.js';

/**
 * This command gets information about a single user.
 *
 * @see https://wakatime.com/developers#all_time_since_today
 */
export default new Command({
    name: 'help',
    description: 'A little help center ;)',
    run: async ({ interaction }) => {
        const embed = defaultEmbed()
            .setTitle('Help Center')
            .setDescription('Here is some useful information about the bot.')
            .addFields([
                {
                    name: 'Developer',
                    value: '> The developer of this bot is **fl4wless**.',
                },
                {
                    name: 'Commands',
                    value: '> `/authorize` - Link your WakaTime account\n> `/profile [user]` - View coding profile with language chart\n> `/rank` - Server leaderboard with pie chart\n> `/toplangs` - Server-wide top languages\n> `/languagestats <language>` - Stats for a specific language\n> `/project <user>` - Project breakdown\n> `/all-time-since-today` - Total coding time ever\n> `/revoke` - Info on revoking access\n> `/help` - This message',
                },
                {
                    name: 'Source Code',
                    value: '> The source code of this bot is available on [GitHub](https://github.com/zFl4wless/wakatime-discord-bot). Feel free to contribute!',
                },
                {
                    name: 'Support',
                    value: '> If you have any questions or suggestions, feel free to direct message me on Discord or open an issue on GitHub.',
                },
            ]);

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    },
});
