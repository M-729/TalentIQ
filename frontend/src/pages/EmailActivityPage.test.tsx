import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { EmailActivityPage } from "@/pages/EmailActivityPage";
import * as emailActivityApi from "@/services/api/emailActivity";
import * as rejectionApi from "@/services/api/rejection";
import type { EmailActivityRow } from "@/types/emailActivity";

vi.mock("@/services/api/emailActivity");
vi.mock("@/services/api/interviewNotifications");
vi.mock("@/services/api/applicationAssessments");
vi.mock("@/services/api/offers");
vi.mock("@/services/api/rejection");
vi.mock("@/services/api/team");

function buildRow(overrides: Partial<EmailActivityRow> = {}): EmailActivityRow {
  return {
    id: "email-1",
    source: "email_notification",
    type: "application_rejection",
    type_label: "Application Rejection",
    recipient_email: "ahmad@test.test",
    status: "sent",
    sent_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    related_label: "Ahmad Khalil — Backend Developer",
    related_application_id: "app-1",
    ...overrides,
  };
}

function mockList(emails: EmailActivityRow[], total = emails.length) {
  vi.mocked(emailActivityApi.listEmailActivity).mockResolvedValue({
    emails,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <EmailActivityPage />
    </MemoryRouter>
  );
}

describe("EmailActivityPage", () => {
  beforeEach(() => {
    vi.mocked(emailActivityApi.listEmailActivity).mockReset();
  });

  // 30. table renders
  it("30. renders the email activity table", async () => {
    mockList([buildRow()]);
    renderPage();

    const recipientCell = await screen.findByText("ahmad@test.test");
    expect(recipientCell).toBeInTheDocument();
    const row = recipientCell.closest("tr")!;
    expect(row).toHaveTextContent("Application Rejection");
    expect(row).toHaveTextContent("Ahmad Khalil — Backend Developer");
  });

  // 31. search
  it("31. calls the API with the debounced search term", async () => {
    mockList([]);
    renderPage();
    await waitFor(() => expect(emailActivityApi.listEmailActivity).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText("Search recipient"), "ahmad");
    await waitFor(
      () => expect(emailActivityApi.listEmailActivity).toHaveBeenLastCalledWith(expect.objectContaining({ search: "ahmad" }), expect.anything()),
      { timeout: 2000 }
    );
  });

  // 32. type filter
  it("32. filters by type", async () => {
    mockList([]);
    renderPage();
    await waitFor(() => expect(emailActivityApi.listEmailActivity).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Filter by type"), "offer_sent");
    await waitFor(() =>
      expect(emailActivityApi.listEmailActivity).toHaveBeenLastCalledWith(expect.objectContaining({ type: "offer_sent" }), expect.anything())
    );
  });

  // 33. status filter
  it("33. filters by status", async () => {
    mockList([]);
    renderPage();
    await waitFor(() => expect(emailActivityApi.listEmailActivity).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "failed");
    await waitFor(() =>
      expect(emailActivityApi.listEmailActivity).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }), expect.anything())
    );
  });

  // 34. pagination
  it("34. renders pagination when there are multiple pages", async () => {
    mockList([buildRow()], 45);
    renderPage();

    expect(await screen.findByText(/Page 1 of/)).toBeInTheDocument();
  });

  // 35. failed state clear
  it("35. shows a clear Failed badge and a Retry action for a failed email", async () => {
    mockList([buildRow({ status: "failed" })]);
    renderPage();

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("35. calls the category-specific retry endpoint for a failed application_rejection email", async () => {
    mockList([buildRow({ status: "failed" })]);
    vi.mocked(rejectionApi.retryRejectionEmail).mockResolvedValue({
      notification: {
        id: "n1",
        status: "sent",
        subject: "s",
        recipient_email: "a@test.test",
        attempted_at: null,
        sent_at: null,
        failure_code: null,
        attempt_count: 1,
        created_at: "2026-09-20T00:00:00.000Z",
      },
    });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(rejectionApi.retryRejectionEmail).toHaveBeenCalledWith("app-1"));
  });

  // 36. related-record navigation
  it("36. links View to the related Application", async () => {
    mockList([buildRow()]);
    renderPage();

    const link = await screen.findByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/applications/app-1");
  });

  it("links a company_invitation row's View to Settings > Team", async () => {
    mockList([
      buildRow({
        type: "company_invitation",
        source: "company_invitation",
        type_label: "Company Invitation",
        related_application_id: undefined,
        related_invitation_id: "invitation-1",
        related_label: "Invited as HR",
      }),
    ]);
    renderPage();

    const link = await screen.findByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/settings/team");
  });

  // Backend confirms every EmailNotification-sourced row (including
  // offer_sent and assessment_invitation) is application-scoped and always
  // carries related_application_id, and no dedicated /offers/:id or
  // /assessments/:id frontend route exists — so relatedLinkFor's existing
  // fallback to related_application_id is already the correct destination
  // for these categories, not a gap. These pin that down as a regression
  // test rather than leaving it as an unverified assumption.
  it("links an offer_sent row's View to the related Application, not a nonexistent offer route", async () => {
    mockList([
      buildRow({
        type: "offer_sent",
        type_label: "Offer Sent",
        related_application_id: "app-1",
        related_offer_id: "offer-1",
      }),
    ]);
    renderPage();

    const link = await screen.findByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/applications/app-1");
  });

  it("links an assessment_invitation row's View to the related Application, not a nonexistent assessment route", async () => {
    mockList([
      buildRow({
        type: "assessment_invitation",
        type_label: "Assessment Invitation",
        related_application_id: "app-1",
        related_assessment_id: "assessment-1",
      }),
    ]);
    renderPage();

    const link = await screen.findByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/applications/app-1");
  });

  // 37. empty/loading/error states
  it("37. shows the empty state when there is no email activity", async () => {
    mockList([]);
    renderPage();
    expect(await screen.findByText(/No email activity yet/)).toBeInTheDocument();
  });

  it("37. shows an error state with retry", async () => {
    vi.mocked(emailActivityApi.listEmailActivity).mockRejectedValue(new Error("network down"));
    renderPage();
    expect(await screen.findByText("Couldn't load email activity")).toBeInTheDocument();
  });
});
