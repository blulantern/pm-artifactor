import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 32 } as const;
const VERIFIER_PLAINTEXT = "pma-vault-v1";

export interface Kdf {
  name: "scrypt";
  N: number;
  r: number;
  p: number;
  salt: string; // base64
}

export function newKdf(): Kdf {
  return { name: "scrypt", N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: randomBytes(16).toString("base64") };
}

export function deriveKey(passphrase: string, kdf: Kdf): Buffer {
  return scryptSync(passphrase, Buffer.from(kdf.salt, "base64"), SCRYPT.keyLen, { N: kdf.N, r: kdf.r, p: kdf.p });
}

/** base64( iv(12) ‖ ciphertext ‖ tag(16) ) */
export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64");
}

/** Throws if the key is wrong (GCM auth-tag failure) or the blob is malformed. */
export function decrypt(key: Buffer, blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function makeVerifier(key: Buffer): string {
  return encrypt(key, VERIFIER_PLAINTEXT);
}

export function checkVerifier(key: Buffer, verifier: string): boolean {
  try {
    return decrypt(key, verifier) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
