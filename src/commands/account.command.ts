import { Command } from '../structure/Command';
import sodium from 'libsodium-wrappers-sumo';
import { userStates } from '../api';
import { getAccounts, deleteAccount, setDefaultAccount, getDefaultAccount } from '../db/account/account.model';
import { defaultEmbed, errorEmbed } from '../utils/embeds';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default new Command({
    name: 'account',
    description: 'Manage your multiple WakaTime API accounts.',
    options: [
        {
            name: 'add',
            description: 'Add a new WakaTime API account.',
            type: 1,
            options: [
                {
                    name: 'name',
                    description: 'A name for this account (e.g. "hakatime", "work").',
                    type: 3,
                    required: true,
                },
                {
                    name: 'url',
                    description: 'The API base URL (e.g. https://wakatime.com).',
                    type: 3,
                    required: true,
                },
            ],
        },
        {
            name: 'list',
            description: 'List all your accounts.',
            type: 1,
        },
        {
            name: 'remove',
            description: 'Remove an account.',
            type: 1,
            options: [
                {
                    name: 'name',
                    description: 'The account name to remove.',
                    type: 3,
                    required: true,
                },
            ],
        },
        {
            name: 'default',
            description: 'Set your default account.',
            type: 1,
            options: [
                {
                    name: 'name',
                    description: 'The account name to set as default.',
                    type: 3,
                    required: true,
                },
            ],
        },
    ],
    run: async ({ interaction, args }) => {
        const sub = args.getSubcommand();

        if (sub === 'add') {
            const name = args.getString('name', true);
            const url = args.getString('url', true);

            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return interaction.reply({
                    embeds: [errorEmbed('Invalid URL', 'URL must start with http:// or https://')],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const state = sodium.randombytes_buf(32, 'hex');
            userStates.set(state, {
                discordUserId: interaction.user.id,
                apiBaseUrl: url,
                accountName: name,
            });

            const authorizeQueryParams = {
                client_id: process.env.CLIENT_ID,
                redirect_uri: `${process.env.API_URL}/redirect`,
                response_type: 'code',
                scope: 'email,read_logged_time,read_stats',
                state: state,
            };

            const embed = defaultEmbed()
                .setTitle(`Add Account: ${name}`)
                .setDescription(`Click below to authorize **${name}** on **${url}**.`);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel(`Login with ${name}`)
                    .setURL(`${url}/oauth/authorize?${new URLSearchParams(authorizeQueryParams)}`),
            );

            await interaction.reply({
                embeds: [embed],
                components: [buttons as any],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'list') {
            const accounts = await getAccounts(interaction.user.id);

            if (accounts.length === 0) {
                return interaction.reply({
                    embeds: [errorEmbed('No Accounts', 'Use `/authorize` or `/account add` to add one.')],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const defaultAcc = await getDefaultAccount(interaction.user.id);
            const fields = accounts.map((a) => ({
                name: `${a.name}${defaultAcc?.name === a.name ? ' ⭐' : ''}`,
                value: `\`\`\`${a.apiBaseUrl}\`\`\`${a.wakaUsername ? `WakaTime: **${a.wakaUsername}**` : ''}`,
                inline: false,
            }));

            await interaction.reply({
                embeds: [defaultEmbed().setTitle('Your Accounts').setFields(fields)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'remove') {
            const name = args.getString('name', true);

            try {
                await deleteAccount(interaction.user.id, name);
                await interaction.reply({
                    embeds: [defaultEmbed().setTitle('Account Removed').setDescription(`**${name}** has been removed.`)],
                    flags: MessageFlags.Ephemeral,
                });
            } catch {
                await interaction.reply({
                    embeds: [errorEmbed('Not Found', `No account named **${name}**.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        if (sub === 'default') {
            const name = args.getString('name', true);
            const account = await getAccounts(interaction.user.id);
            if (!account.find((a) => a.name === name)) {
                return interaction.reply({
                    embeds: [errorEmbed('Not Found', `No account named **${name}**.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            await setDefaultAccount(interaction.user.id, name);
            await interaction.reply({
                embeds: [defaultEmbed().setTitle('Default Set').setDescription(`**${name}** is now your default account.`)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    },
});
