import { AIScreeningRun, type AIScreeningRunDoc, type AIScreeningRunStatus } from "../../models/AIScreeningRun.model";
import { AIScreening, type AIScreeningDoc } from "../../models/AIScreening.model";
import { ConflictError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { getSafeScreeningFailureMessage } from "../../modules/screenings/screening.errors";
import { env } from "../../config/env";
import { createApplicationScreening } from "./screeningHistory.service";

const ALREADY_PROCESSING_MESSAGE = "AI screening is already in progress for this application.";
const ALREADY_COMPLETED_MESSAGE = "This application has already been screened.";

// The one centralized place this duration is computed from
// env.AI_SCREENING_PROCESSING_TIMEOUT_MINUTES — every staleness check in
// this file (and applicationHr.service.ts's batched summaries, via
// resolveReportedStatus below) goes through this, never a hard-coded
// number of its own.
const STALE_PROCESSING_THRESHOLD_MS = env.AI_SCREENING_PROCESSING_TIMEOUT_MINUTES * 60 * 1000;

/**
 * A run stuck in "processing" past this threshold is treated as
 * interrupted (e.g. the backend crashed/restarted mid-screening) rather
 * than genuinely still in flight — a real screening (CV extraction + one
 * Groq call) normally finishes in seconds, so this is a generous margin,
 * not a tight one. `attempted_at` doubles as "processing started at" for
 * this purpose: it is set to `new Date()` at the exact moment a run
 * transitions into "processing" (see reserveScreeningRunForProcessing
 * below) and touched nowhere else, so its age while status is
 * "processing" is exactly how long this attempt has been running.
 */
export function isRunStale(run: Pick<AIScreeningRunDoc, "status" | "attempted_at">): boolean {
  return run.status === "processing" && !!run.attempted_at && Date.now() - run.attempted_at.getTime() > STALE_PROCESSING_THRESHOLD_MS;
}

/** Everything getEffectiveScreeningState/getLatestScreeningSummaries may ever report — "stale_processing" is a purely DERIVED overlay, never a persisted AIScreeningRun.status value. */
export type ReportedScreeningStatus = AIScreeningRunStatus | "not_started" | "stale_processing";

/**
 * The single place "what status should HR see" is decided from a run row
 * (or its absence) plus whether a completed AIScreening already exists —
 * shared verbatim by getEffectiveScreeningState (below, single Application)
 * and applicationHr.service.ts's getLatestScreeningSummaries (batched, one
 * pass over many Applications), so the two can never drift from each
 * other on this logic.
 *
 * Success-safety: a stale "processing" row does NOT automatically mean
 * "interrupted, nothing happened" — the underlying AI call may have
 * actually succeeded and the crash happened between persisting the
 * AIScreening and writing "completed" back onto the run row. When a
 * completed AIScreening already exists, that persisted result always
 * wins and is reported as "completed", never "stale_processing" — this
 * function itself never touches the database; see
 * reserveScreeningRunForProcessing for where that inconsistency is
 * actually self-healed once discovered.
 */
export function resolveReportedStatus(
  run: Pick<AIScreeningRunDoc, "status" | "attempted_at"> | null,
  hasCompletedScreening: boolean
): ReportedScreeningStatus {
  if (!run) {
    return hasCompletedScreening ? "completed" : "not_started";
  }
  if (isRunStale(run)) {
    return hasCompletedScreening ? "completed" : "stale_processing";
  }
  return run.status;
}

export interface EffectiveScreeningState {
  status: ReportedScreeningStatus;
  run: AIScreeningRunDoc | null;
}

/**
 * Read-only, never triggers AI. Resolves the current initial-screening
 * state for ONE Application, with a safe fallback for Applications that
 * predate this feature (see Part 6/task report):
 *   - a real AIScreeningRun row exists -> its status is authoritative,
 *     UNLESS it's stale "processing" (see resolveReportedStatus/isRunStale)
 *     — reported as "stale_processing" (or "completed" if a screening was
 *     actually persisted despite the crash), never silently left as a
 *     plain "processing" HR can never recover from.
 *   - no row, but a completed AIScreening already exists (legacy data
 *     from before automatic screening existed) -> reported as "completed",
 *     WITHOUT creating a row or touching anything — a plain read never
 *     writes.
 *   - neither exists -> "not_started" (a legacy Application never
 *     screened at all).
 */
export async function getEffectiveScreeningState(applicationId: string): Promise<EffectiveScreeningState> {
  const run = await AIScreeningRun.findOne({ application_id: applicationId });
  if (!run) {
    const hasCompletedScreening = await AIScreening.exists({ application_id: applicationId });
    return { status: hasCompletedScreening ? "completed" : "not_started", run: null };
  }

  if (isRunStale(run)) {
    const hasCompletedScreening = await AIScreening.exists({ application_id: applicationId });
    return { status: resolveReportedStatus(run, !!hasCompletedScreening), run };
  }

  return { status: run.status, run };
}

/**
 * Atomically claims the right to run this Application's initial screening
 * right now — the single concurrency choke point shared by BOTH the
 * automatic trigger (application.service.ts, right after a public
 * Application is created) and the explicit HR-facing retry/start action
 * (screening.service.ts's createScreening). This is what guarantees "no
 * two simultaneous INITIAL screenings for the same Application" at the
 * database level, not just in application code:
 *
 *   1. Lazily creates the run row on first use (covers both a brand-new
 *      automatic trigger and a legacy Application being adopted into this
 *      model for the first time via a manual "Start Screening" click).
 *      The unique index on application_id is the actual safety net here —
 *      a losing concurrent create() is resolved by re-reading the winner's
 *      row rather than erroring.
 *   2. Rejects outright (ConflictError) if the row is already "completed",
 *      or "processing" AND still fresh (not stale) — matches this
 *      ticket's explicit rule that retry is only ever available for
 *      "failed", missing/legacy, or STALE processing state, never
 *      completed or genuinely in-flight processing.
 *   3. For a STALE "processing" row specifically: first checks whether a
 *      completed AIScreening already exists for this Application (the
 *      underlying AI call may have actually succeeded and only the
 *      run-state write crashed afterward) — if so, self-heals the row to
 *      "completed" right here and rejects the reclaim, since the
 *      persisted result always wins and must never be silently
 *      overwritten by a second AI execution.
 *   4. Performs the actual reclaim — pending/failed, OR stale processing
 *      — into "processing" as ONE guarded findOneAndUpdate whose filter
 *      re-checks staleness AT WRITE TIME (`attempted_at` at or before the
 *      threshold), not just from the read above. If two callers race here
 *      (an automatic trigger and a concurrent manual retry, two retry
 *      clicks, or a still-genuinely-running attempt that completes in the
 *      tiny window between the read and this write), only one update's
 *      filter still matches; the loser gets `null` back and is turned
 *      into the same ConflictError, never a second concurrent AI call.
 */
export async function reserveScreeningRunForProcessing(applicationId: string, jobId: string): Promise<AIScreeningRunDoc> {
  let run = await AIScreeningRun.findOne({ application_id: applicationId });

  if (!run) {
    try {
      run = await AIScreeningRun.create({ application_id: applicationId, job_id: jobId, status: "pending" });
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }
      const existing = await AIScreeningRun.findOne({ application_id: applicationId });
      if (!existing) {
        throw err;
      }
      run = existing;
    }
  }

  if (run.status === "completed") {
    throw new ConflictError(ALREADY_COMPLETED_MESSAGE);
  }

  if (run.status === "processing") {
    if (!isRunStale(run)) {
      throw new ConflictError(ALREADY_PROCESSING_MESSAGE);
    }

    // Stale processing — success-safety check before treating it as
    // recoverable: maybe the screening actually finished and only the
    // run-state write never landed (crash between the two). The
    // persisted AIScreening always wins over a stale in-memory
    // assumption that nothing happened.
    const existingScreening = await AIScreening.findOne({ application_id: applicationId }).sort({ created_at: -1 });
    if (existingScreening) {
      await AIScreeningRun.updateOne(
        { _id: run._id, status: "processing" },
        { $set: { status: "completed", screening_id: existingScreening._id, failure_code: null, failure_message: null } }
      );
      throw new ConflictError(ALREADY_COMPLETED_MESSAGE);
    }
    // Genuinely stale and unrecovered — falls through to the guarded
    // reclaim below, which is what actually re-verifies staleness
    // atomically at write time.
  }

  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
  const reserved = await AIScreeningRun.findOneAndUpdate(
    {
      _id: run._id,
      $or: [{ status: { $in: ["pending", "failed"] } }, { status: "processing", attempted_at: { $lte: staleThreshold } }],
    },
    { $set: { status: "processing", attempted_at: new Date() }, $inc: { attempt_count: 1 } },
    { new: true }
  );
  if (!reserved) {
    // Lost the race — some other caller already moved this run past
    // pending/failed/stale-processing between our read above and this
    // write (an automatic trigger, a concurrent retry, or the
    // originally-stale attempt actually completing just in time).
    throw new ConflictError(ALREADY_PROCESSING_MESSAGE);
  }
  return reserved;
}

/**
 * Runs the existing, untouched screening pipeline (createApplicationScreening
 * — CV extraction, AI analysis, deterministic scoring, persisted as a new
 * immutable AIScreening) for an ALREADY-RESERVED run, and durably records
 * the outcome on the run row itself: "completed" + a pointer to the new
 * AIScreening, or "failed" + a safe code/message. The underlying error
 * (already safe/specific) is always re-thrown afterward so callers keep
 * their own existing behavior — screening.service.ts's synchronous HR
 * path maps it to an HTTP error exactly as before; the automatic
 * background path (triggerInitialScreeningInBackground below) is the only
 * caller that swallows it.
 */
export async function runAndFinalizeScreening(run: AIScreeningRunDoc): Promise<AIScreeningDoc> {
  try {
    const screening = await createApplicationScreening(run.application_id.toString());
    await AIScreeningRun.updateOne(
      { _id: run._id },
      { $set: { status: "completed", screening_id: screening._id, failure_code: null, failure_message: null } }
    );
    return screening;
  } catch (err) {
    const code = err instanceof Error && "code" in err ? String((err as { code?: unknown }).code) : "unknown";
    const message = getSafeScreeningFailureMessage(err);
    await AIScreeningRun.updateOne({ _id: run._id }, { $set: { status: "failed", failure_code: code, failure_message: message } });
    throw err;
  }
}

/**
 * The automatic, best-effort entry point — called exactly once, right
 * after a public Application is successfully created (see
 * application.service.ts's submitPublicApplication), and deliberately
 * NEVER awaited by its caller: the candidate's HTTP response must not
 * wait for a multi-second CV-extraction + AI round trip. This is a plain
 * synchronous function (not itself async) precisely so a caller can never
 * accidentally `await` it — the Promise chain below is started and given
 * its own `.catch` in the same tick, so nothing here is ever an unhandled
 * rejection, and no failure here (including a reservation failure) can
 * ever affect the Application that has already been persisted.
 *
 * KNOWN LIMITATION (documented, not hidden — see this ticket's own Part
 * 3/4 notes on why a real queue was judged out of scope here): this runs
 * in-process with no durable job backing it. If the Node process crashes
 * or restarts between reservation and completion, the run can be left
 * "processing" indefinitely with no automatic recovery; the invariants
 * above only guarantee no DUPLICATE work ever happens, not eventual
 * completion after a crash. A stuck "processing" row is something an
 * operator would need to notice and clear manually (out of scope here).
 */
export function triggerInitialScreeningInBackground(applicationId: string, jobId: string): void {
  reserveScreeningRunForProcessing(applicationId, jobId)
    .then((run) => runAndFinalizeScreening(run))
    .then(() => {
      // Outcome already durably persisted by runAndFinalizeScreening —
      // nothing further to do on success.
    })
    .catch((err: unknown) => {
      // Reached only for a reservation-step failure or anything
      // runAndFinalizeScreening itself couldn't persist — its own
      // completion/failure path already logs+persists separately. Only
      // safe metadata is logged, matching every other AI/CV log line in
      // this codebase (never CV text, never a raw provider message).
      const code = err instanceof Error && "code" in err ? (err as { code?: unknown }).code : undefined;
      console.error("[ai] automatic initial screening did not complete", { applicationId, code });
    });
}
