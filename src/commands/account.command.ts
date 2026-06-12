import { Command } from '../structure/Command';
import sodium from 'libsodium-wrappers-sumo';
import { userStates } from '../api';
import { getAccounts, deleteAccount, setDefaultAccount, getDefaultAccount, updateAccount } from '../db/account/account.model';
import { defaultEmbed, errorEmbed } from '../utils/embeds';
import { resolveForkUrl, resolveClientCredentials, getKnownForkNames } from '../utils/resolve-fork';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default new Command({
    name: 'account',
    description: 'Manage your Hackatime accounts.',
    options: [
        {
            name: 'add',
            description: 'Add a new API account (e.g. "hackatime", "wakatime").',
            type: 1,
            options: [
                {
                    name: 'name',
                    description: 'Which service? (hackatime, wakatime, or a custom URL)',
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
        {
            name: 'embed',
            description: 'Set WakaTime embed chart URLs for flex posts.',
            type: 1,
            options: [
                {
                    name: 'account',
                    description: 'The account name.',
                    type: 3,
                    required: true,
                },
                {
                    name: 'chart',
                    description: 'Chart type (languages, projects).',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Languages', value: 'languages' },
                        { name: 'Projects', value: 'projects' },
                    ],
                },
                {
                    name: 'url',
                    description: 'The embed chart URL from wakatime.com/share/embed.',
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
            const apiBaseUrl = resolveForkUrl(name);
            const { clientId, clientSecret } = resolveClientCredentials(name);

            if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
                const known = getKnownForkNames().map((f) => `\`${f}\``).join(', ');
                return interaction.reply({
                    embeds: [errorEmbed('Unknown Service',
                        `Could not resolve **${name}** to a URL.\nKnown services: ${known || '(none configured)'}\n\nUse a full URL instead, or set the fork's env var.`)],
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

            const scope = apiBaseUrl.includes('hackatime') ? 'profile read' : 'email,read_logged_time,read_stats';

            const authorizeQueryParams = {
                client_id: clientId,
                redirect_uri: `${process.env.API_URL}/redirect`,
                response_type: 'code',
                scope,
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
                value: `\`\`\`${a.apiBaseUrl}\`\`\`${a.wakaUsername ? `Username: **${a.wakaUsername}**` : ''}`,
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

        if (sub === 'embed') {
            const accountName = args.getString('account', true);
            const chartType = args.getString('chart', true);
            const url = args.getString('url', true);

            const account = await getAccounts(interaction.user.id);
            const target = account.find((a) => a.name === accountName);
            if (!target) {
                return interaction.reply({
                    embeds: [errorEmbed('Not Found', `No account named **${accountName}**.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const currentUrls = target.embedUrls as Record<string, string> | null || {};
            currentUrls[chartType] = url;

            await updateAccount(interaction.user.id, accountName, { embedUrls: currentUrls });
            await interaction.reply({
                embeds: [defaultEmbed().setTitle('Embed Chart Set').setDescription(
                    `**${chartType}** chart URL set for account **${accountName}**.`
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    },
});
