import type { UserRole } from "../../models/User.model";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        companyId: string;
        role: UserRole;
      };
    }
  }
}

export {};
