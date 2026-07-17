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
