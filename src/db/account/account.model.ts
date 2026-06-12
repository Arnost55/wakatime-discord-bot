import { prismaClient } from '../prisma';
import { AccountDto } from './account.dto';

/**
 * Create a new WakaAccount record.
 */
export async function saveAccount(data: AccountDto) {
    return prismaClient.wakaAccount.create({ data });
}

/**
 * Update an existing account identified by userId + name.
 */
export async function updateAccount(userId: string, name: string, data: Partial<AccountDto>) {
    return prismaClient.wakaAccount.update({
        where: { userId_name: { userId, name } },
        data,
    });
}

/**
 * Create or update (upsert) an account by userId + name.
 * Used during OAuth callback to persist tokens and user info.
 */
export async function upsertAccount(data: AccountDto) {
    return prismaClient.wakaAccount.upsert({
        where: { userId_name: { userId: data.userId, name: data.name } },
        update: {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            wakaUsername: data.wakaUsername,
            wakaUserId: data.wakaUserId,
            embedUrls: data.embedUrls,
        },
        create: data,
    });
}

/**
 * Get a single account by userId and account name.
 */
export async function getAccount(userId: string, name: string) {
    return prismaClient.wakaAccount.findUnique({
        where: { userId_name: { userId, name } },
    });
}

/**
 * Get all accounts for a Discord user.
 */
export async function getAccounts(userId: string) {
    return prismaClient.wakaAccount.findMany({ where: { userId } });
}

/**
 * Get the default account for a user.
 * Falls back to the first account found if no default is set.
 */
export async function getDefaultAccount(userId: string) {
    const user = await prismaClient.user.findUnique({ where: { userId } });
    if (user?.defaultAccount) {
        const account = await getAccount(userId, user.defaultAccount);
        if (account) return account;
    }
    return prismaClient.wakaAccount.findFirst({ where: { userId } });
}

/**
 * Set (or unset) the default account name for a user.
 */
export async function setDefaultAccount(userId: string, name: string) {
    await prismaClient.user.upsert({
        where: { userId },
        update: { defaultAccount: name },
        create: { userId, defaultAccount: name, accessToken: '', refreshToken: '' },
    });
}

/**
 * Delete an account by userId and name.
 */
export async function deleteAccount(userId: string, name: string) {
    return prismaClient.wakaAccount.delete({
        where: { userId_name: { userId, name } },
    });
}

/**
 * Get all accounts that use a given API base URL (for instance-scoped queries).
 */
export async function getAllAccountsForInstance(apiBaseUrl: string) {
    return prismaClient.wakaAccount.findMany({ where: { apiBaseUrl } });
}

/**
 * One-time migration: copy all legacy User tokens into WakaAccount records
 * with name "default". Runs on startup for backward compatibility.
 */
export async function migrateExistingUsersToAccounts() {
    const users = await prismaClient.user.findMany({
        where: {
            wakaUsername: { not: null },
        },
    });

    for (const user of users) {
        const existing = await prismaClient.wakaAccount.findFirst({
            where: { userId: user.userId, name: 'default' },
        });
        if (!existing) {
            const baseUrl = process.env.WAKATIME_BASE_URL || 'https://wakatime.com';
            await prismaClient.wakaAccount.create({
                data: {
                    userId: user.userId,
                    name: 'default',
                    apiBaseUrl: baseUrl,
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                    wakaUsername: user.wakaUsername,
                    wakaUserId: user.wakaUserId,
                },
            });
            console.log(`Migrated user ${user.userId} to WakaAccount`);
        }
    }
}
