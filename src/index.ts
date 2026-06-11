import './api/index';
import dotenv from 'dotenv';
import sodium from 'libsodium-wrappers-sumo';
import { ExtendedClient } from './structure/Client';
import { generateKeyPair } from './utils/crypto';
import { Logger } from 'tslog';
import { startDigestScheduler } from './services/digest';

dotenv.config();

export const logger = new Logger();

export const client = new ExtendedClient();
client.start();

let keys: sodium.KeyPair;
sodium.ready.then(() => {
    keys = generateKeyPair();
});
startDigestScheduler();
export { keys };
