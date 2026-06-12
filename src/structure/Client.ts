import { ApplicationCommandDataResolvable, Client, Collection, GatewayIntentBits } from 'discord.js';
import { glob } from 'glob';
import { RegisterCommandsOptions } from '../types/core/Client';
import { logger } from '..';
import { CommandType } from '../types/core/Command';
import path from 'path';

/**
 * The extended client.
 * @extends {Client} The discord.js client.
 * @property {Collection<string, CommandType>} commands The commands.
 */
export class ExtendedClient extends Client {
    commands: Collection<string, CommandType> = new Collection();

    constructor() {
        super({ intents: [GatewayIntentBits.Guilds] });
    }

    /**
     * Starts the client.
     */
    async start() {
        await this.registerModules();
        this.login(process.env.BOT_TOKEN);
    }

    /**
     * Imports a file.
     *
     * @param filePath The path to the file.
     * @returns The default export of the file.
     */
    async importFile(filePath: string) {
        return (await import(filePath)).default;
    }

    /**
     * Registers commands.
     *
     * @param options The options for registering commands.
     * @param options.commands The commands to register.
     * @param options.guildId The guild id to register the commands in.
     */
    async registerCommands({ commands, guildId }: RegisterCommandsOptions) {
        if (guildId) {
            await this.guilds.cache.get(guildId)?.commands.set(commands);
            logger.info(`Registering commands to ${guildId}`);
        } else {
            await this.application?.commands.set(commands);
            logger.info(`Registering commands to global`);
        }
    }

    /**
     * Registers modules. (Commands and Events)
     */
    async registerModules() {
        const slashCommands: ApplicationCommandDataResolvable[] = [];

        // Commands
        const commandsDir = path.join(__dirname, '..', 'commands');
        const commandFiles = await glob(`${commandsDir}/**/*.{ts,js}`);
        for (const filePath of commandFiles) {
            const command: CommandType = await this.importFile(filePath);
            if (!command.name) continue;
            logger.info(`Registering command ${command.name}...`);

            this.commands.set(command.name, command);
            slashCommands.push(command);
        }

        this.on('clientReady', () => {
            this.registerCommands({ commands: slashCommands, guildId: process.env.GUILD_ID });
        });

        // Events
        const eventsDir = path.join(__dirname, '..', 'events');
        const eventFiles = await glob(`${eventsDir}/**/*.{ts,js}`);
        for (const filePath of eventFiles) {
            const event = await this.importFile(filePath);
            logger.info(`Registering event ${event.name}...`);

            this.on(event.name, event.run);
        }
    }
}
