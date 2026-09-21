import crypto from "node:crypto";
import { env } from "../config/env";

// AES-256-GCM: authenticated encryption (confidentiality + integrity) —
// a plain cipher mode (e.g. AES-CBC) would let a tampered ciphertext
// decrypt to garbage silently instead of failing loudly. A Google refresh
// token is exactly the kind of long-lived secret this protects against
// (see GoogleCalendarConnection.model.ts — this is the only place a
// Google refresh token is ever persisted, and never in plaintext).
const ALGORITHM = "aes-256-gcm";
// 96 bits — the size NIST recommends for GCM and what Node's
// implementation is tuned for; using a different length works but loses
// the performance/security guarantees GCM was designed around.
const IV_LENGTH_BYTES = 12;

export interface EncryptedTokenPayload {
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

function getEncryptionKey(): Buffer {
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    // Mirrors the R2/SMTP/GROQ "unconfigured -> clear error at the point
    // of use, not at boot" convention — the rest of the backend (and the
    // full test suite, which never calls this) must keep working without
    // this being set.
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(env.GOOGLE_TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256");
  }
  return key;
}

/**
 * Encrypts a Google refresh token for storage. Every call uses a fresh,
 * cryptographically random IV (never reused — IV reuse is what breaks
 * GCM's security guarantees), so encrypting the same plaintext twice
 * produces different ciphertext each time. The auth tag is what lets
 * decryptToken detect any tampering with the stored ciphertext/iv.
 */
export function encryptToken(plaintext: string): EncryptedTokenPayload {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: authTag.toString("base64"),
  };
}

/**
 * Decrypts a stored refresh token. Throws if the auth tag doesn't match
 * (tampered/corrupted data or wrong key) rather than returning garbage —
 * callers must treat that as a hard failure, never as a usable token.
 */
export function decryptToken(payload: EncryptedTokenPayload): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.auth_tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
