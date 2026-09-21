import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleInterviewDialog } from "@/components/interviews/ScheduleInterviewDialog";
import { buildInterview } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as interviewsApi from "@/services/api/interviews";
import * as usersApi from "@/services/api/users";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/users");

const INTERVIEWER = { id: "user-1", name: "Alex Interviewer", email: "alex@example.test" };

function futureDateParts(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const date = d.toISOString().slice(0, 10);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

async function fillValidForm() {
  const start = futureDateParts(48);
  const end = futureDateParts(49);
  await userEvent.type(screen.getByLabelText(/^Date/), start.date);
  await userEvent.type(screen.getByLabelText(/^Start time/), start.time);
  await userEvent.type(screen.getByLabelText(/^End time/), end.time);
  await userEvent.click(screen.getByText(INTERVIEWER.name));
}

describe("ScheduleInterviewDialog", () => {
  beforeEach(() => {
    vi.mocked(interviewsApi.scheduleInterview).mockReset();
    vi.mocked(usersApi.listInterviewerCandidates).mockReset().mockResolvedValue({ users: [INTERVIEWER] });
  });

  function renderDialog(onScheduled = vi.fn()) {
    render(
      <ScheduleInterviewDialog
        open
        onOpenChange={() => {}}
        applicationId="application-1"
        defaultTitle="Technical Interview"
        onScheduled={onScheduled}
      />
    );
    return { onScheduled };
  }

  it("defaults the title field to the current stage name", async () => {
    renderDialog();
    const titleInput = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(titleInput.placeholder).toBe("Technical Interview");
  });

  it("requires at least one interviewer", async () => {
    renderDialog();
    await screen.findByLabelText(/^Date/);

    const start = futureDateParts(48);
    const end = futureDateParts(49);
    await userEvent.type(screen.getByLabelText(/^Date/), start.date);
    await userEvent.type(screen.getByLabelText(/^Start time/), start.time);
    await userEvent.type(screen.getByLabelText(/^End time/), end.time);
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    expect(await screen.findByText("At least one interviewer is required")).toBeInTheDocument();
    expect(interviewsApi.scheduleInterview).not.toHaveBeenCalled();
  });

  it("sends a valid request DTO with ISO starts_at/ends_at, timezone, and selected interviewer ids", async () => {
    vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview() });
    renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    await waitFor(() => expect(interviewsApi.scheduleInterview).toHaveBeenCalled());
    const [applicationId, body] = vi.mocked(interviewsApi.scheduleInterview).mock.calls[0]!;
    expect(applicationId).toBe("application-1");
    expect(body.interviewer_user_ids).toEqual(["user-1"]);
    expect(() => new Date(body.starts_at).toISOString()).not.toThrow();
    expect(body.starts_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(body.ends_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(typeof body.timezone).toBe("string");
    expect(body.timezone.length).toBeGreaterThan(0);
  });

  it("calls onScheduled and closes on success", async () => {
    const interview = buildInterview({ id: "new-interview-1" });
    vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview });
    const { onScheduled } = renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    await waitFor(() => expect(onScheduled).toHaveBeenCalledWith(interview));
  });

  it("shows a safe message for a duplicate/existing-interview conflict (409), never the raw backend message", async () => {
    vi.mocked(interviewsApi.scheduleInterview).mockRejectedValue(new ApiError("E11000 duplicate key error", 409));
    renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    expect(
      await screen.findByText(
        "An interview is already scheduled for this stage, or this application is not currently eligible for scheduling."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/E11000/)).not.toBeInTheDocument();
  });

  it("shows a safe message for a generic server error, never the raw backend message", async () => {
    vi.mocked(interviewsApi.scheduleInterview).mockRejectedValue(new ApiError("TypeError: cannot read x of undefined", 500));
    renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    expect(await screen.findByText("The interview could not be scheduled. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });
});
