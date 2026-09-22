import { Types } from "mongoose";
import { InterviewFeedback } from "../src/models/InterviewFeedback.model";

function validAttrs(overrides: Record<string, unknown> = {}) {
  return {
    company_id: new Types.ObjectId(),
    interview_id: new Types.ObjectId(),
    application_id: new Types.ObjectId(),
    interviewer_user_id: new Types.ObjectId(),
    interviewer_snapshot: { name: "Alice Interviewer", email: "alice@example.test" },
    ...overrides,
  };
}

describe("InterviewFeedback model", () => {
  it("persists a valid draft feedback record", async () => {
    const doc = await InterviewFeedback.create(validAttrs());
    expect(doc._id).toBeDefined();
  });

  it("defaults status to draft", async () => {
    const doc = await InterviewFeedback.create(validAttrs());
    expect(doc.status).toBe("draft");
  });

  it("defaults recommendation to null and text fields to empty strings", async () => {
    const doc = await InterviewFeedback.create(validAttrs());
    expect(doc.recommendation).toBeNull();
    expect(doc.summary).toBe("");
    expect(doc.strengths).toBe("");
    expect(doc.concerns).toBe("");
    expect(doc.private_notes).toBe("");
    expect(doc.submitted_at).toBeNull();
  });

  it.each(["company_id", "interview_id", "application_id", "interviewer_user_id", "interviewer_snapshot"])(
    "requires %s",
    async (field) => {
      const attrs = validAttrs() as Record<string, unknown>;
      delete attrs[field];
      await expect(InterviewFeedback.create(attrs)).rejects.toThrow();
    }
  );

  // 14. valid statuses
  it("rejects an invalid status", async () => {
    await expect(InterviewFeedback.create(validAttrs({ status: "approved" }))).rejects.toThrow();
  });

  it("accepts every documented status", async () => {
    for (const status of ["draft", "submitted"]) {
      await expect(
        InterviewFeedback.create(
          validAttrs({
            status,
            interview_id: new Types.ObjectId(),
            ...(status === "submitted" ? { recommendation: "yes", summary: "Solid candidate.", submitted_at: new Date() } : {}),
          })
        )
      ).resolves.toBeTruthy();
    }
  });

  // 15. valid recommendation values
  it("rejects an invalid recommendation value", async () => {
    await expect(InterviewFeedback.create(validAttrs({ recommendation: "super_yes" }))).rejects.toThrow();
  });

  it("accepts every documented recommendation value", async () => {
    for (const recommendation of ["strong_yes", "yes", "mixed", "no", "strong_no"]) {
      await expect(
        InterviewFeedback.create(validAttrs({ interview_id: new Types.ObjectId(), recommendation }))
      ).resolves.toBeTruthy();
    }
  });

  // 13. interviewer snapshot persisted
  it("persists the interviewer snapshot exactly as given", async () => {
    const doc = await InterviewFeedback.create(
      validAttrs({ interviewer_snapshot: { name: "Bob Jones", email: "bob@example.test" } })
    );
    expect(doc.interviewer_snapshot.name).toBe("Bob Jones");
    expect(doc.interviewer_snapshot.email).toBe("bob@example.test");
  });

  it("enforces a max length on free-text fields", async () => {
    await expect(InterviewFeedback.create(validAttrs({ summary: "x".repeat(4001) }))).rejects.toThrow();
  });

  // 12. unique Interview + interviewer
  describe("uniqueness on (interview_id, interviewer_user_id)", () => {
    it("prevents two feedback records for the same interview + interviewer", async () => {
      const interviewId = new Types.ObjectId();
      const interviewerId = new Types.ObjectId();
      await InterviewFeedback.create(validAttrs({ interview_id: interviewId, interviewer_user_id: interviewerId }));

      await expect(
        InterviewFeedback.create(validAttrs({ interview_id: interviewId, interviewer_user_id: interviewerId }))
      ).rejects.toThrow();
    });

    it("allows different interviewers to each have their own record for the same interview", async () => {
      const interviewId = new Types.ObjectId();
      await InterviewFeedback.create(validAttrs({ interview_id: interviewId, interviewer_user_id: new Types.ObjectId() }));

      await expect(
        InterviewFeedback.create(validAttrs({ interview_id: interviewId, interviewer_user_id: new Types.ObjectId() }))
      ).resolves.toBeTruthy();
    });

    it("allows the same interviewer to have records for different interviews", async () => {
      const interviewerId = new Types.ObjectId();
      await InterviewFeedback.create(validAttrs({ interview_id: new Types.ObjectId(), interviewer_user_id: interviewerId }));

      await expect(
        InterviewFeedback.create(validAttrs({ interview_id: new Types.ObjectId(), interviewer_user_id: interviewerId }))
      ).resolves.toBeTruthy();
    });

    it("has a unique index on { interview_id, interviewer_user_id }", () => {
      const indexes = InterviewFeedback.schema.indexes();
      const uniqueIndex = indexes.find(([spec, options]) => spec.interview_id === 1 && spec.interviewer_user_id === 1 && options.unique);
      expect(uniqueIndex).toBeDefined();
    });
  });
});
