import { Command } from '../structure/Command';
import sodium from 'libsodium-wrappers-sumo';
import { userStates } from '../api';
import { getAccounts, deleteAccount, setDefaultAccount, getDefaultAccount } from '../db/account/account.model';
import { defaultEmbed, errorEmbed } from '../utils/embeds';
import { resolveForkUrl, resolveClientCredentials, getKnownForkNames } from '../utils/resolve-fork';
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
                    description: 'API base URL or fork name. Default: resolves name as a fork.',
                    type: 3,
                    required: false,
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
            const rawUrl = args.getString('url');
            const forkIdentifier = rawUrl || name;
            const apiBaseUrl = rawUrl ? resolveForkUrl(rawUrl) : resolveForkUrl(name);
            const { clientId, clientSecret } = resolveClientCredentials(forkIdentifier);

            if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
                const known = getKnownForkNames().map((f) => `\`${f}\``).join(', ');
                return interaction.reply({
                    embeds: [errorEmbed('Unknown Fork',
                        `Could not resolve **${name}** to a URL.\nKnown forks: ${known || '(none configured)'}\n\nUse a full URL instead, or set \`WAKATIME_FORK_${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}\` in the bot's env.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const state = sodium.randombytes_buf(32, 'hex');
            userStates.set(state, {
                discordUserId: interaction.user.id,
                apiBaseUrl,
                accountName: name,
                clientId,
                clientSecret,
            });

            const authorizeQueryParams = {
                client_id: clientId,
                redirect_uri: `${process.env.API_URL}/redirect`,
                response_type: 'code',
                scope: 'email,read_logged_time,read_stats',
                state: state,
            };

            const embed = defaultEmbed()
                .setTitle(`Add Account: ${name}`)
                .setDescription(`Click below to authorize **${name}** on **${apiBaseUrl}**.`);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel(`Login with ${name}`)
                    .setURL(`${apiBaseUrl}/oauth/authorize?${new URLSearchParams(authorizeQueryParams)}`),
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
