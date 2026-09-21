import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { listInterviewerCandidatesHandler } from "./user.controller";

// Mounted at /api/v1/users. Deliberately minimal — this is NOT the full
// Admin/User Management module (no create/update/deactivate here); it
// exists only to give the frontend a safe, read-only list of this
// company's active Users to pick as interviewers, so interview scheduling
// never has to accept arbitrary emails.
export const userRouter = Router();

userRouter.use(requireAuth, requireRole("HR", "ADMIN"));

userRouter.get("/", listInterviewerCandidatesHandler);
