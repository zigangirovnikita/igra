import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

export function encryptField(value: string): string {
  if (!value) return '';
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptField(value: string): string {
  if (!value) return '';
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted field');
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function encryptionKey(): Buffer {
  const raw = process.env.LEAD_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'test') return createHash('sha256').update('launch-game-test-key').digest();
    throw new Error('LEAD_ENCRYPTION_KEY is not configured');
  }

  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) {
    throw new Error('LEAD_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return decoded;
}
