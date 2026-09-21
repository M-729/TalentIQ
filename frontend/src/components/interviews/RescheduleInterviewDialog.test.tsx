import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RescheduleInterviewDialog } from "@/components/interviews/RescheduleInterviewDialog";
import { buildInterview } from "@/test/fixtures";
import * as interviewsApi from "@/services/api/interviews";
import * as usersApi from "@/services/api/users";
import type { Interview } from "@/types/interview";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/users");

const INTERVIEWER = { id: "user-1", name: "Alex Interviewer", email: "alex@example.test" };

function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function buildFutureInterview(overrides: Partial<Interview> = {}): Interview {
  return buildInterview({
    starts_at: futureIso(48),
    ends_at: futureIso(49),
    interviewers: [INTERVIEWER],
    ...overrides,
  });
}

describe("RescheduleInterviewDialog", () => {
  beforeEach(() => {
    vi.mocked(interviewsApi.rescheduleInterview).mockReset();
    vi.mocked(usersApi.listInterviewerCandidates).mockReset().mockResolvedValue({ users: [INTERVIEWER] });
  });

  function renderDialog(interview: Interview = buildFutureInterview(), onRescheduled = vi.fn()) {
    render(
      <RescheduleInterviewDialog open onOpenChange={() => {}} interview={interview} onRescheduled={onRescheduled} />
    );
    return { onRescheduled };
  }

  // 11. reschedule submit disabled while request pending
  it("disables the submit button while the reschedule request is pending", async () => {
    let resolveFn: (value: { interview: Interview }) => void = () => {};
    const pending = new Promise<{ interview: Interview }>((resolve) => {
      resolveFn = resolve;
    });
    vi.mocked(interviewsApi.rescheduleInterview).mockReturnValue(pending);
    renderDialog();

    const button = await screen.findByRole("button", { name: "Save changes" });
    await userEvent.click(button);

    const pendingButton = await screen.findByRole("button", { name: "Saving…" });
    expect(pendingButton).toBeDisabled();

    resolveFn({ interview: buildFutureInterview() });
    await waitFor(() => expect(interviewsApi.rescheduleInterview).toHaveBeenCalledTimes(1));
  });

  // 12. rapid repeated submit does not cause duplicate API mutation
  it("does not send a duplicate reschedule request when the submit button is clicked rapidly, repeatedly", async () => {
    let resolveFn: (value: { interview: Interview }) => void = () => {};
    const pending = new Promise<{ interview: Interview }>((resolve) => {
      resolveFn = resolve;
    });
    vi.mocked(interviewsApi.rescheduleInterview).mockReturnValue(pending);
    renderDialog();

    const button = await screen.findByRole("button", { name: "Save changes" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(interviewsApi.rescheduleInterview).toHaveBeenCalledTimes(1));

    resolveFn({ interview: buildFutureInterview() });
    await waitFor(() => expect(interviewsApi.rescheduleInterview).toHaveBeenCalledTimes(1));
  });

  it("calls onRescheduled and closes on success", async () => {
    const updated = buildFutureInterview({ id: "interview-1" });
    vi.mocked(interviewsApi.rescheduleInterview).mockResolvedValue({ interview: updated });
    const { onRescheduled } = renderDialog();

    const button = await screen.findByRole("button", { name: "Save changes" });
    await userEvent.click(button);

    await waitFor(() => expect(onRescheduled).toHaveBeenCalledWith(updated));
  });
});
