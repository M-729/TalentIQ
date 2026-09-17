import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../security/AppError";
import * as authService from "./auth.service";
import { env } from "../../config/env";
import type { LoginInput } from "./auth.validation";

const REFRESH_COOKIE_NAME = "talentiq_refresh_token";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  const { user, tokens } = await authService.login(email, password, req.ip);

  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  res.status(200).json({ accessToken: tokens.accessToken, user });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawRefreshToken) {
    throw new UnauthorizedError("Missing refresh token");
  }

  const { user, tokens } = await authService.refresh(rawRefreshToken, req.ip);

  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  res.status(200).json({ accessToken: tokens.accessToken, user });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawRefreshToken) {
    await authService.logout(rawRefreshToken);
  }
  clearRefreshCookie(res);
  res.status(204).send();
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getSafeUserById(req.auth!.userId);
  res.status(200).json({ user });
});
