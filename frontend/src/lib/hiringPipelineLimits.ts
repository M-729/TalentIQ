// Mirrors backend/src/modules/hiringPipeline/hiringPipelineBoard.validation.ts's
// MAX_BULK_MOVE_APPLICATIONS exactly (a zod .max(100) — 100 is allowed, 101
// is the first count the backend rejects with 400). This frontend copy
// exists purely to give a pre-emptive warning before a doomed request is
// even sent; the backend remains the sole authoritative enforcement point
// and is never bypassed or altered by this constant.
export const MAX_BULK_MOVE_APPLICATIONS = 100;
