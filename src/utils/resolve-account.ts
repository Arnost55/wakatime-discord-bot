import { getAccount, getDefaultAccount, getAccounts } from '../db/account/account.model';

export async function resolveAccount(
    userId: string,
    accountName?: string | null,
) {
    if (accountName) {
        return getAccount(userId, accountName);
    }
    return getDefaultAccount(userId);
}

export async function getAccountChoices(userId: string) {
    const accounts = await getAccounts(userId);
    return accounts.map((a) => ({ name: `${a.name} (${a.apiBaseUrl})`, value: a.name }));
}
