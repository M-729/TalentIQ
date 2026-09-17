import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../security/AppError";
import { verifyAccessToken } from "../security/tokens";
import { User } from "../models/User.model";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Verifies the access token AND re-checks the user's current status/company/role
 * in the database on every request. This costs one extra lean read per request,
 * but it means a disabled account or a changed role/company takes effect
 * immediately instead of waiting up to one access-token lifetime (15 min) to expire.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError("Missing access token");
    }

    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub).select("company_id role status").lean();
    if (!user || user.status !== "active") {
      throw new UnauthorizedError("Account is not active");
    }

    req.auth = {
      userId: user._id.toString(),
      companyId: user.company_id.toString(),
      role: user.role,
    };

    next();
  } catch (err) {
    next(err instanceof Error ? err : new UnauthorizedError());
  }
}
