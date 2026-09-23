import { z } from "zod";
import { Types } from "mongoose";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const ANALYTICS_RANGES = ["30d", "90d", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

// Deliberately NOT `.strict()` — query schemas in this codebase never are.
export const getHiringAnalyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES).default("30d"),
  jobId: objectIdString("job id").optional(),
});
export type GetHiringAnalyticsQuery = z.infer<typeof getHiringAnalyticsQuerySchema>;
