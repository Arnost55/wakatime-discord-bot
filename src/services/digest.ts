import cron from 'node-cron';
import axios from 'axios';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { client } from '..';
import { prismaClient } from '../db/prisma';
import { StatsResponse } from '../types/wakatime/stats.types';

const scheduledJobs: cron.ScheduledTask[] = [];

/**
 * Convert a 24h time string ("HH:MM") to a cron expression.
 * @param time - Time in 24h format (e.g. "09:00").
 * @returns A cron expression (e.g. "0 9 * * *").
 */
function parseCron(time: string): string {
    const [hour, minute] = time.split(':');
    return `${minute} ${hour} * * *`;
}

/**
 * Build and send a daily coding digest embed to a configured channel.
 * Fetches stats for all registered users, sorts by total time, and
 * posts a ranked leaderboard with top-3 language breakdowns.
 */
async function sendDigest(config: { guildId: string; channelId: string; time: string; timezone: string }) {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
    if (!channel) return;

    const users = await prismaClient.user.findMany({
        where: { wakaUsername: { not: null } },
    });

    if (users.length === 0) return;

    const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
    const statsResults = await Promise.allSettled(
        users.map((u) =>
            axios<StatsResponse>(`${baseUrl}/api/v1/users/${u.wakaUsername}/stats`).then((r) => ({
                username: u.wakaUsername!,
                data: r.data.data,
            })),
        ),
    );

    const entries: { username: string; total_seconds: number; human_readable_total: string; languages: string }[] = [];

    for (const result of statsResults) {
        if (result.status === 'fulfilled') {
            const topLangs = result.value.data.languages
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 3)
                .map((l) => `${l.name} ${l.percent}%`)
                .join(', ');

            entries.push({
                username: result.value.username,
                total_seconds: result.value.data.total_seconds,
                human_readable_total: result.value.data.human_readable_total,
                languages: topLangs || 'No data',
            });
        }
    }

    if (entries.length === 0) return;

    entries.sort((a, b) => b.total_seconds - a.total_seconds);
    const totalHours = Math.round(entries.reduce((s, e) => s + e.total_seconds, 0) / 3600);

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('Daily Coding Digest')
        .setDescription(`**${entries.length}** users tracked · **${totalHours}** total hours`)
        .setTimestamp();

    entries.slice(0, 15).forEach((entry, i) => {
        embed.addFields({
            name: `#${i + 1} ${entry.username}`,
            value: `${entry.human_readable_total}\nLanguages: ${entry.languages}`,
            inline: false,
        });
    });

    await channel.send({ embeds: [embed] });
}

/**
 * Start all active digest schedules from the database.
 * Reads every enabled DigestConfig and registers a cron job for it.
 */
export async function startDigestScheduler() {
    const configs = await prismaClient.digestConfig.findMany({ where: { enabled: true } });

    for (const config of configs) {
        const expression = parseCron(config.time);
        if (cron.validate(expression)) {
            const job = cron.schedule(expression, () => sendDigest(config), {
                timezone: config.timezone,
            });
            scheduledJobs.push(job);
            console.log(`Digest scheduled for guild ${config.guildId} at ${config.time} ${config.timezone}`);
        }
    }
}

/**
 * Stop all running digest schedulers and reload from the database.
 * Called after a /digest configuration change to apply the new settings immediately.
 */
export async function reloadDigestScheduler() {
    for (const job of scheduledJobs) {
        job.stop();
    }
    scheduledJobs.length = 0;
    await startDigestScheduler();
}
