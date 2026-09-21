import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { requireSecret } from '../security/secretsLoader.ts';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = 1;
const KMS_KEY_REF = 'local-dev';
const KMS_KEY_VERSION = 'v1';

export interface SecretCipher {
  readonly keyRef: string;
  readonly keyVersion: string;
  encrypt(plaintext: string): Buffer;
  decrypt(ciphertext: Buffer): string;
}

function localDevKey(): Buffer {
  if (process.env.KMS_PROVIDER !== 'local-dev') {
    throw new Error('Non-prod TOTP encryption requires KMS_PROVIDER=local-dev.');
  }

  return createHash('sha256')
    .update(requireSecret('KMS_LOCAL_MASTER_KEY'), 'utf8')
    .digest();
}

export class NonProdLocalSecretCipher implements SecretCipher {
  public readonly keyRef = KMS_KEY_REF;
  public readonly keyVersion = KMS_KEY_VERSION;

  encrypt(plaintext: string): Buffer {
    if (!plaintext) throw new Error('cannot encrypt an empty secret');

    const cipher = createCipheriv(ALGORITHM, localDevKey(), randomBytes(IV_BYTES));
    const iv = cipher.getIV();
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
  }

  decrypt(ciphertext: Buffer): string {
    if (ciphertext.length <= 1 + IV_BYTES + 16) {
      throw new Error('invalid encrypted secret');
    }

    const version = ciphertext.readUInt8(0);
    if (version !== VERSION) throw new Error('unsupported encrypted secret version');

    const ivStart = 1;
    const tagStart = ivStart + IV_BYTES;
    const dataStart = tagStart + 16;
    const iv = ciphertext.subarray(ivStart, tagStart);
    const tag = ciphertext.subarray(tagStart, dataStart);
    const encrypted = ciphertext.subarray(dataStart);

    const decipher = createDecipheriv(ALGORITHM, localDevKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
