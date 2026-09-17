import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { UserRole } from "../models/User.model";

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  role: UserRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings, not JWTs: the raw value is only ever
 * held by the client, while the server persists a SHA-256 hash. This means a
 * database read/leak alone can't be used to forge a valid refresh token, and
 * individual tokens can be revoked/rotated server-side.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const days = env.JWT_REFRESH_EXPIRES_IN_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
