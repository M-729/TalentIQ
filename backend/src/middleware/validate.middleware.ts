import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { BadRequestError } from "../security/AppError";

interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        next(new BadRequestError("Invalid request body", result.error.flatten()));
        return;
      }
      req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        next(new BadRequestError("Invalid request params", result.error.flatten()));
        return;
      }
      req.params = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        next(new BadRequestError("Invalid query parameters", result.error.flatten()));
        return;
      }
      req.query = result.data;
    }

    next();
  };
}
