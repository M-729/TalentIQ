import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../security/AppError";
import type { UserRole } from "../models/User.model";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(new ForbiddenError("You do not have permission to perform this action"));
      return;
    }

    next();
  };
}
