import { z } from "zod";

// AI output is untrusted input — every object uses .strict() so an
// unexpected extra field (e.g. a hallucinated "recommendedDecision" or
// "candidateScore") fails validation instead of silently passing through.
// Every string/array has a generous-but-bounded limit so a misbehaving
// response can't produce unbounded output; limits are sized for a normal
// CV, not a worst-case adversarial one.

const skillSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    evidence: z.string().trim().max(300).optional(),
  })
  .strict();

const requiredSkillEvidenceSchema = z
  .object({
    skill: z.string().trim().min(1).max(100),
    status: z.enum(["found", "not_found", "unclear"]),
    evidence: z.string().trim().max(300).optional(),
  })
  .strict();

const experienceSchema = z
  .object({
    // Nullable (not calculated when dates are ambiguous) and optional (the
    // model may omit it outright) — both collapse to `null` after parsing,
    // see normalizeCvAnalysisResult in cvAnalysis.service.ts.
    yearsMentioned: z.number().min(0).max(80).nullable().optional(),
    summary: z.string().trim().min(1).max(1000),
  })
  .strict();

export const cvAnalysisResultSchema = z
  .object({
    summary: z.string().trim().min(1).max(1000),
    skills: z.array(skillSchema).max(50),
    experience: experienceSchema,
    education: z.array(z.string().trim().min(1).max(200)).max(20),
    strengths: z.array(z.string().trim().min(1).max(300)).max(15),
    gaps: z.array(z.string().trim().min(1).max(300)).max(15),
    requiredSkillEvidence: z.array(requiredSkillEvidenceSchema).max(50),
  })
  .strict();

export type CvAnalysisResult = z.infer<typeof cvAnalysisResultSchema>;
