// Mirrors backend src/modules/users/user.service.ts's UserDirectoryEntryDTO
// exactly — a minimal, read-only interviewer picker source, not a full
// User Management record.
export interface InterviewerCandidate {
  id: string;
  name: string;
  email: string;
}
