import { Command } from '../structure/Command';
import { defaultEmbed } from '../utils/embeds';
import { MessageFlags } from 'discord.js';

export default new Command({
    name: 'help',
    description: 'Shows all available commands.',
    run: async ({ interaction }) => {
        const embed = defaultEmbed()
            .setTitle('Help')
            .setDescription('Here are all the commands you can use.')
            .addFields([
                {
                    name: 'Getting Started',
                    value: '> `/authorize` - Link your Hackatime account\n> `/account add/list/remove/default` - Manage multiple accounts\n> `/account embed` - Set chart URLs for public flex posts',
                },
                {
                    name: 'Your Stats',
                    value: '> `/profile [user] [range]` - Your coding profile with chart\n> `/project <user>` - Project breakdown\n> `/goals` - Your goal progress\n> `/all-time-since-today` - Total coding time ever',
                },
                {
                    name: 'Community',
                    value: '> `/compare <user1> <user2>` - Compare two users\n> `/rank [range]` - Leaderboard with pagination\n> `/toplangs` - Top languages across all users\n> `/languagestats <language>` - Who uses a language the most',
                },
                {
                    name: 'Other',
                    value: '> `/digest <channel> <time>` - Daily coding digest\n> `/revoke` - Revoke access\n> `/help` - This message',
                },
                {
                    name: 'Need Help?',
                    value: '> Questions or suggestions? Message the developer or open an issue on [GitHub](https://github.com/zFl4wless/wakatime-discord-bot).',
                },
            ]);

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    },
});
