import { User, type UserRole, type UserStatus } from "../../models/User.model";
import { RefreshToken } from "../../models/RefreshToken.model";
import { comparePassword } from "../../security/password";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
  signAccessToken,
} from "../../security/tokens";
import { UnauthorizedError } from "../../security/AppError";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function toSafeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  company_id: unknown;
}): SafeUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    companyId: String(user.company_id),
  };
}

async function issueTokens(user: SafeUser, ip?: string): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, companyId: user.companyId, role: user.role });

  const rawRefreshToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiryDate();

  await RefreshToken.create({
    user_id: user.id,
    token_hash: hashRefreshToken(rawRefreshToken),
    expires_at: expiresAt,
    created_by_ip: ip,
  });

  return { accessToken, refreshToken: rawRefreshToken, refreshTokenExpiresAt: expiresAt };
}

export async function login(email: string, password: string, ip?: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const userDoc = await User.findOne({ email }).select("+password_hash");

  // Same generic message whether the email doesn't exist or the password is
  // wrong, and whether the account is disabled — avoids leaking which case it is.
  if (!userDoc || userDoc.status !== "active") {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await comparePassword(password, userDoc.password_hash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  userDoc.last_login_at = new Date();
  await userDoc.save();

  const user = toSafeUser(userDoc);
  const tokens = await issueTokens(user, ip);

  return { user, tokens };
}

export async function refresh(rawRefreshToken: string, ip?: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ token_hash: tokenHash });

  if (!stored) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  if (stored.revoked_at) {
    // A previously-rotated (revoked) token being presented again is a strong
    // signal the token was stolen and reused. Revoke every active refresh
    // token for this user to cut off the compromised session family.
    await RefreshToken.updateMany(
      { user_id: stored.user_id, revoked_at: null },
      { $set: { revoked_at: new Date() } }
    );
    throw new UnauthorizedError("Session invalid, please log in again");
  }

  if (stored.expires_at.getTime() < Date.now()) {
    throw new UnauthorizedError("Refresh token expired");
  }

  const userDoc = await User.findById(stored.user_id);
  if (!userDoc || userDoc.status !== "active") {
    throw new UnauthorizedError("Account is not active");
  }

  const user = toSafeUser(userDoc);
  const tokens = await issueTokens(user, ip);

  stored.revoked_at = new Date();
  stored.replaced_by_token_hash = hashRefreshToken(tokens.refreshToken);
  await stored.save();

  return { user, tokens };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await RefreshToken.updateOne(
    { token_hash: tokenHash, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );
}

export async function getSafeUserById(userId: string): Promise<SafeUser> {
  const userDoc = await User.findById(userId);
  if (!userDoc || userDoc.status !== "active") {
    throw new UnauthorizedError("Account is not active");
  }
  return toSafeUser(userDoc);
}
