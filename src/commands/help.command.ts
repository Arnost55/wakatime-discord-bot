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
                    value: '> `/authorize [name] [url]` - Link a WakaTime account\n> `/account add/list/remove/default` - Manage multiple API accounts\n> `/profile [user] [account] [range]` - Coding profile with chart\n> `/rank [instance] [range]` - Leaderboard with pie chart + pages\n> `/compare <user1> <user2> [account1] [account2]` - Cross-instance compare\n> `/toplangs [instance]` - Top languages with bar chart\n> `/languagestats <language> [instance]` - Language stats\n> `/project <user> [account]` - Project breakdown\n> `/goals [account]` - Your WakaTime goal progress\n> `/digest <channel> <time>` - Setup daily coding digest\n> `/all-time-since-today` - Total coding time ever\n> `/revoke` - Info on revoking access\n> `/help` - This message',
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
