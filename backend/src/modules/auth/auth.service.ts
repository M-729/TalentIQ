import mongoose from "mongoose";
import { User, type UserDoc, type UserRole, type UserStatus } from "../../models/User.model";
import { Company } from "../../models/Company.model";
import { RefreshToken } from "../../models/RefreshToken.model";
import { comparePassword, hashPassword } from "../../security/password";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
  signAccessToken,
} from "../../security/tokens";
import { ConflictError, UnauthorizedError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";

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

// Exported so other flows that produce a freshly-authenticated User
// outside of login (company-signup, invitation acceptance) can reuse the
// exact same SafeUser shape and token-issuance mechanics, rather than
// re-deriving them — see auth.controller.ts's companySignupHandler and
// modules/companyInvitationResponse/companyInvitationResponse.service.ts's
// acceptCompanyInvitation.
export function toSafeUser(user: {
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

export async function issueTokens(user: SafeUser, ip?: string): Promise<AuthTokens> {
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

const EMAIL_TAKEN_MESSAGE = "An account with this email already exists.";

/**
 * Public self-service Company signup — creates a brand-new Company and its
 * first User (always role="ADMIN", the only privileged value this
 * endpoint can ever produce, and always for the Company it just created in
 * the SAME atomic operation, never an existing one — see this ticket's
 * explicit "the only reason the public creator becomes ADMIN is they are
 * creating a BRAND NEW company" rule). Company and User are created inside
 * one Mongo transaction so neither can be left orphaned if the other
 * fails, mirroring offerEmail.service.ts's sendOffer transaction shape
 * exactly. Immediately issues the same access/refresh tokens login()
 * does, so a successful signup is indistinguishable from a successful
 * login from the client's perspective — no second auth mechanism.
 */
export async function signupCompany(
  input: { fullName: string; email: string; password: string; companyName: string },
  ip?: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const email = input.email.trim().toLowerCase();

  const session = await mongoose.startSession();
  let createdUser: UserDoc | undefined;
  try {
    await session.withTransaction(async () => {
      const [company] = await Company.create([{ name: input.companyName }], { session });
      const passwordHash = await hashPassword(input.password);
      const [user] = await User.create(
        [
          {
            company_id: company!._id,
            name: input.fullName,
            email,
            password_hash: passwordHash,
            role: "ADMIN",
            status: "active",
          },
        ],
        { session }
      );
      createdUser = user;
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(EMAIL_TAKEN_MESSAGE);
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const user = toSafeUser(createdUser!);
  const tokens = await issueTokens(user, ip);
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
