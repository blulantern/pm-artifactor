import { expect, test } from "vitest";
import { newKdf, deriveKey, encrypt, decrypt, makeVerifier, checkVerifier } from "./crypto.js";

test("deriveKey is deterministic for a given passphrase + kdf", () => {
  const kdf = newKdf();
  expect(deriveKey("hunter2hunter2", kdf).equals(deriveKey("hunter2hunter2", kdf))).toBe(true);
  expect(deriveKey("hunter2hunter2", kdf).equals(deriveKey("different-pass", kdf))).toBe(false);
});

test("encrypt → decrypt round-trips; wrong key fails", () => {
  const kdf = newKdf();
  const key = deriveKey("correct-horse", kdf);
  const blob = encrypt(key, "s3cr3t-token");
  expect(blob).not.toContain("s3cr3t-token"); // ciphertext, not plaintext
  expect(decrypt(key, blob)).toBe("s3cr3t-token");
  const wrong = deriveKey("battery-staple", kdf);
  expect(() => decrypt(wrong, blob)).toThrow(); // GCM auth-tag mismatch
});

test("verifier confirms the right key and rejects the wrong one", () => {
  const kdf = newKdf();
  const key = deriveKey("pass-one-two", kdf);
  const v = makeVerifier(key);
  expect(checkVerifier(key, v)).toBe(true);
  expect(checkVerifier(deriveKey("nope-nope-nope", kdf), v)).toBe(false);
});

test("empty-plaintext round-trip", () => {
  const kdf = newKdf();
  const key = deriveKey("empty-test", kdf);
  const blob = encrypt(key, "");
  expect(decrypt(key, blob)).toBe("");
});

test("IV uniqueness: same plaintext + key produces different ciphertexts", () => {
  const kdf = newKdf();
  const key = deriveKey("iv-test", kdf);
  const plaintext = "same";
  const blob1 = encrypt(key, plaintext);
  const blob2 = encrypt(key, plaintext);
  expect(blob1).not.toBe(blob2); // different IVs produce different ciphertexts
  expect(decrypt(key, blob1)).toBe(plaintext);
  expect(decrypt(key, blob2)).toBe(plaintext);
});

test("salt uniqueness and KDF params verification", () => {
  const kdf1 = newKdf();
  const kdf2 = newKdf();
  expect(kdf1.salt).not.toBe(kdf2.salt); // different salts

  // verify KDF parameters
  expect(kdf1.name).toBe("scrypt");
  expect(kdf1.N).toBe(16384);
  expect(kdf1.r).toBe(8);
  expect(kdf1.p).toBe(1);

  // verify deriveKey returns 32-byte Buffer (AES-256 key size)
  const key = deriveKey("salt-test", kdf1);
  expect(key.length).toBe(32);
  expect(Buffer.isBuffer(key)).toBe(true);
});

test("malformed blob throws on decrypt", () => {
  const kdf = newKdf();
  const key = deriveKey("malformed-test", kdf);

  // invalid base64
  expect(() => decrypt(key, "not-valid-base64-!!!")).toThrow();

  // too-short blob (needs at least 12 bytes IV + 16 bytes tag)
  expect(() => decrypt(key, Buffer.alloc(10).toString("base64"))).toThrow();

  // blob that is exactly the right length but with wrong tag (should fail GCM validation)
  const validBlob = encrypt(key, "test");
  const buf = Buffer.from(validBlob, "base64");
  const corruptedBuf = Buffer.from(buf);
  const lastByteIdx = corruptedBuf.length - 1;
  if (lastByteIdx >= 0) {
    corruptedBuf.writeUInt8((corruptedBuf.readUInt8(lastByteIdx) ^ 0xff), lastByteIdx);
  }
  expect(() => decrypt(key, corruptedBuf.toString("base64"))).toThrow();
});
