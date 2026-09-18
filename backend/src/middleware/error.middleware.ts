import type { NextFunction, Request, Response } from "express";
import { Error as MongooseError } from "mongoose";
import multer from "multer";
import { AppError } from "../security/AppError";
import { env } from "../config/env";

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

export function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof MongooseError.ValidationError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        details: Object.values(err.errors).map((e) => e.message),
      },
    });
    return;
  }

  if (err instanceof MongooseError.CastError) {
    res.status(400).json({ error: { message: "Invalid identifier" } });
    return;
  }

  if (isDuplicateKeyError(err)) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : "field";
    res.status(409).json({ error: { message: `${field} already in use` } });
    return;
  }

  if (err instanceof Error && (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")) {
    res.status(401).json({ error: { message: "Invalid or expired token" } });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5 MB)" : "Invalid file upload";
    res.status(400).json({ error: { message } });
    return;
  }

  console.error("[unhandled error]", err);

  res.status(500).json({
    error: {
      message: "Internal server error",
      ...(env.NODE_ENV !== "production" && err instanceof Error ? { details: err.message } : {}),
    },
  });
}
