import { apiClient } from "@/services/api/client";
import type { InterviewerCandidate } from "@/types/user";

// The company's active Users, valid as interview interviewers — never a
// general Admin/User Management listing. See backend
// src/modules/users/user.service.ts.
export function listInterviewerCandidates(signal?: AbortSignal): Promise<{ users: InterviewerCandidate[] }> {
  return apiClient.get<{ users: InterviewerCandidate[] }>("/users", signal);
}
