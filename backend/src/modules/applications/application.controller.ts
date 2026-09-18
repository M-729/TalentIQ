import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { BadRequestError } from "../../security/AppError";
import * as applicationService from "./application.service";
import type { SubmitApplicationInput } from "./application.validation";

export const submitApplicationHandler = asyncHandler(async (req: Request, res: Response) => {
  // multer populates req.file for the "cv" field when present; it does
  // not itself reject a missing file (the field is optional as far as
  // multer is concerned), so that check belongs here.
  if (!req.file) {
    throw new BadRequestError("A CV file is required.");
  }

  await applicationService.submitPublicApplication(req.params.id!, req.body as SubmitApplicationInput, {
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
  });

  res.status(201).json({ message: "Application submitted successfully" });
});
