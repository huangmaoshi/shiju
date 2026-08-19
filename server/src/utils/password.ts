import * as crypto from 'crypto';

const SALT_LEN = 16;
const KEY_LEN = 64;
const ITERATIONS = 120000;
const DIGEST = 'sha512';

function hashPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_LEN).toString('hex');
    const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
    return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
    const [salt, hex] = stored.split(':');
    if (!salt || !hex) return false;
    const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
    return crypto.timingSafeEqual(Buffer.from(hex, 'hex'), derived);
}

export { hashPassword, verifyPassword };
