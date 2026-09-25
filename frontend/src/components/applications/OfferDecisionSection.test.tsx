import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfferDecisionSection } from "@/components/applications/OfferDecisionSection";
import { buildApplicationDetail, buildOffer, buildOfferNotification, buildRejectionInfo } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as offersApi from "@/services/api/offers";
import * as rejectionApi from "@/services/api/rejection";

vi.mock("@/services/api/offers");
vi.mock("@/services/api/rejection");

function renderSection(application = buildApplicationDetail(), onApplicationChanged = vi.fn()) {
  return render(<OfferDecisionSection application={application} onApplicationChanged={onApplicationChanged} />);
}

describe("OfferDecisionSection", () => {
  beforeEach(() => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockReset();
    vi.mocked(offersApi.createOffer).mockReset();
    vi.mocked(offersApi.updateOffer).mockReset();
    vi.mocked(offersApi.sendOffer).mockReset();
    vi.mocked(offersApi.markOfferAccepted).mockReset();
    vi.mocked(offersApi.markOfferDeclined).mockReset();
    vi.mocked(offersApi.withdrawOffer).mockReset();
    vi.mocked(offersApi.markApplicationHired).mockReset();
    vi.mocked(offersApi.listOfferNotifications).mockReset().mockResolvedValue({ notifications: [] });
    vi.mocked(offersApi.retryOfferNotification).mockReset();
    vi.mocked(rejectionApi.rejectApplication).mockReset();
    vi.mocked(rejectionApi.retryRejectionEmail).mockReset();
    vi.mocked(rejectionApi.getRejectionInfo).mockReset().mockResolvedValue({ rejection: buildRejectionInfo() });
  });

  // 1. active candidate shows Create Offer / Reject
  it("shows Create Offer and Reject Candidate for an active application with no offer", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    renderSection();

    expect(await screen.findByRole("button", { name: "Create Offer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject Candidate" })).toBeInTheDocument();
  });

  // 2. create Draft
  it("creates a draft offer via the Create Offer form", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    vi.mocked(offersApi.createOffer).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Create Offer" }));
    await userEvent.type(screen.getByLabelText(/Offer title/), "Backend Engineer");
    await userEvent.click(screen.getByRole("button", { name: "Save Offer" }));

    await waitFor(() =>
      expect(offersApi.createOffer).toHaveBeenCalledWith(
        "application-1-public",
        expect.objectContaining({ title: "Backend Engineer" })
      )
    );
  });

  it("requires both salary amount and currency together", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Create Offer" }));
    await userEvent.type(screen.getByLabelText(/Offer title/), "Backend Engineer");
    await userEvent.type(screen.getByLabelText("Salary amount"), "90000");
    await userEvent.click(screen.getByRole("button", { name: "Save Offer" }));

    expect(await screen.findByText(/Enter both a salary amount and a currency/)).toBeInTheDocument();
    expect(offersApi.createOffer).not.toHaveBeenCalled();
  });

  // 3. edit Draft
  it("edits a draft offer", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
    vi.mocked(offersApi.updateOffer).mockResolvedValue({ offer: buildOffer({ status: "draft", title: "Staff Engineer" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const titleInput = screen.getByLabelText(/Offer title/) as HTMLInputElement;
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Staff Engineer");
    await userEvent.click(screen.getByRole("button", { name: "Save Offer" }));

    await waitFor(() => expect(offersApi.updateOffer).toHaveBeenCalledWith("offer-1-public", expect.objectContaining({ title: "Staff Engineer" })));
  });

  // 4. Send Offer
  it("sends the draft offer", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
    vi.mocked(offersApi.sendOffer).mockResolvedValue({ notification: buildOfferNotification() });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Send Offer" }));
    await waitFor(() => expect(offersApi.sendOffer).toHaveBeenCalledWith("offer-1-public"));
  });

  // 5. failed email shows Retry
  it("shows Retry Email for a failed offer notification", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
    vi.mocked(offersApi.listOfferNotifications).mockResolvedValue({
      notifications: [buildOfferNotification({ status: "failed", failure_code: "delivery_failed" })],
    });
    renderSection();

    expect(await screen.findByRole("button", { name: "Retry Email" })).toBeInTheDocument();
  });

  it("retries a failed offer notification", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
    vi.mocked(offersApi.listOfferNotifications).mockResolvedValue({
      notifications: [buildOfferNotification({ id: "notif-1", status: "failed" })],
    });
    vi.mocked(offersApi.retryOfferNotification).mockResolvedValue({ notification: buildOfferNotification({ id: "notif-1", status: "sent" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Retry Email" }));
    await waitFor(() => expect(offersApi.retryOfferNotification).toHaveBeenCalledWith("offer-1-public", "offer-notification-1-public"));
  });

  // 6. Sent offer renders — 1/2. shows "Waiting for candidate response"
  // and no direct primary Mark Accepted/Mark Declined buttons.
  it("renders a sent offer's terms, a waiting message, and no direct Accept/Decline buttons", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
      offer: buildOffer({ status: "sent", salary_amount: 95000, salary_currency: "USD" }),
    });
    renderSection();

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("95,000 USD")).toBeInTheDocument();
    expect(screen.getByText("Waiting for candidate response")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Accepted" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Declined" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw Offer" })).toBeInTheDocument();
    // 3. Record response manually available
    expect(screen.getByRole("button", { name: "Record response manually" })).toBeInTheDocument();
  });

  // 4. manual dialog records Accepted
  it("records an Accepted response via the manual dialog", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
    vi.mocked(offersApi.markOfferAccepted).mockResolvedValue({ offer: buildOffer({ status: "accepted" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Record response manually" }));
    expect(await screen.findByRole("heading", { name: "Record candidate response" })).toBeInTheDocument();
    // "Accepted" is the default selection.
    await userEvent.click(screen.getByRole("button", { name: "Record response" }));
    await waitFor(() => expect(offersApi.markOfferAccepted).toHaveBeenCalledWith("offer-1-public"));
  });

  // 5. manual dialog records Declined
  it("records a Declined response via the manual dialog", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
    vi.mocked(offersApi.markOfferDeclined).mockResolvedValue({ offer: buildOffer({ status: "declined" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Record response manually" }));
    await userEvent.click(await screen.findByLabelText("Declined"));
    await userEvent.click(screen.getByRole("button", { name: "Record response" }));
    await waitFor(() => expect(offersApi.markOfferDeclined).toHaveBeenCalledWith("offer-1-public"));
  });

  // 6. Withdraw still available (already covered by the render test above too)
  it("withdraws a sent offer via confirmation", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
    vi.mocked(offersApi.withdrawOffer).mockResolvedValue({ offer: buildOffer({ status: "withdrawn" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Withdraw Offer" }));
    const dialogButtons = await screen.findAllByRole("button", { name: "Withdraw Offer" });
    await userEvent.click(dialogButtons[dialogButtons.length - 1]!);
    await waitFor(() => expect(offersApi.withdrawOffer).toHaveBeenCalledWith("offer-1-public"));
  });

  // 9. Withdraw
  it("withdraws a draft offer via confirmation", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
    vi.mocked(offersApi.withdrawOffer).mockResolvedValue({ offer: buildOffer({ status: "withdrawn" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    await userEvent.click(await screen.findByRole("button", { name: "Withdraw Offer" }));
    await waitFor(() => expect(offersApi.withdrawOffer).toHaveBeenCalledWith("offer-1-public"));
  });

  // 10. Accepted shows Mark as Hired
  it("shows Mark as Hired for an accepted offer", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "accepted" }) });
    renderSection();

    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as Hired" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Accepted" })).not.toBeInTheDocument();
  });

  // response-source display (candidate vs HR-recorded)
  describe("response source display", () => {
    it("shows 'Accepted by candidate' with a date for a candidate-driven acceptance", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
        offer: buildOffer({ status: "accepted", response_source: "candidate", responded_at: "2026-09-23T00:00:00.000Z" }),
      });
      renderSection();

      expect(await screen.findByText(/Accepted by candidate/)).toBeInTheDocument();
      expect(screen.getByText(/Sep 23, 2026/)).toBeInTheDocument();
    });

    it("shows 'Recorded by HR' for an HR-recorded acceptance", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
        offer: buildOffer({
          status: "accepted",
          response_source: "hr",
          responded_at: "2026-09-23T00:00:00.000Z",
          responded_by: { id: "user-1", name: "Hana HR" },
        }),
      });
      renderSection();

      expect(await screen.findByText(/Accepted · Recorded by HR/)).toBeInTheDocument();
    });

    it("shows 'Declined by candidate' for a candidate-driven decline", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
        offer: buildOffer({ status: "declined", response_source: "candidate", responded_at: "2026-09-23T00:00:00.000Z" }),
      });
      renderSection();

      expect(await screen.findByText(/Declined by candidate/)).toBeInTheDocument();
    });

    it("shows nothing extra when response_source is not yet set", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
        offer: buildOffer({ status: "sent", response_source: null, responded_at: null }),
      });
      renderSection();

      await screen.findByText("Waiting for candidate response");
      expect(screen.queryByText(/Recorded by HR/)).not.toBeInTheDocument();
      expect(screen.queryByText(/by candidate/)).not.toBeInTheDocument();
    });
  });

  it("marks the application hired via confirmation and notifies the parent", async () => {
    const onApplicationChanged = vi.fn();
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "accepted" }) });
    vi.mocked(offersApi.markApplicationHired).mockResolvedValue({
      application: buildApplicationDetail({ status: "hired" }),
      offer: buildOffer({ status: "accepted" }),
    });
    renderSection(buildApplicationDetail(), onApplicationChanged);

    await userEvent.click(await screen.findByRole("button", { name: "Mark as Hired" }));
    const dialogButtons = await screen.findAllByRole("button", { name: "Mark as Hired" });
    await userEvent.click(dialogButtons[dialogButtons.length - 1]!);

    await waitFor(() => expect(offersApi.markApplicationHired).toHaveBeenCalledWith("offer-1-public"));
    await waitFor(() => expect(onApplicationChanged).toHaveBeenCalled());
  });

  // 11. Hired state
  it("renders the Hired state with the historical offer", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
      offer: buildOffer({ status: "accepted", title: "Backend Engineer" }),
    });
    renderSection(buildApplicationDetail({ status: "hired" }));

    expect(await screen.findByText("Hired")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Hired" })).not.toBeInTheDocument();
  });

  // 12. Rejected state
  it("renders the Rejected state with candidate email status", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    vi.mocked(rejectionApi.getRejectionInfo).mockResolvedValue({ rejection: buildRejectionInfo({ email_status: "sent" }) });
    renderSection(buildApplicationDetail({ status: "rejected" }));

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Candidate email: Sent/)).toBeInTheDocument();
  });

  it("shows Retry Email for a failed rejection email", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    vi.mocked(rejectionApi.getRejectionInfo).mockResolvedValue({ rejection: buildRejectionInfo({ email_status: "failed" }) });
    renderSection(buildApplicationDetail({ status: "rejected" }));

    expect(await screen.findByRole("button", { name: "Retry Email" })).toBeInTheDocument();
  });

  it("rejects an active candidate via the Reject Candidate dialog", async () => {
    const onApplicationChanged = vi.fn();
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    vi.mocked(rejectionApi.rejectApplication).mockResolvedValue({
      application: buildApplicationDetail({ status: "rejected" }),
      notification: null,
    });
    renderSection(buildApplicationDetail(), onApplicationChanged);

    await userEvent.click(await screen.findByRole("button", { name: "Reject Candidate" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reject Candidate", hidden: false }));

    await waitFor(() => expect(rejectionApi.rejectApplication).toHaveBeenCalledWith("application-1-public", { send_email: false }));
    await waitFor(() => expect(onApplicationChanged).toHaveBeenCalled());
  });

  it("sends a rejection email when the checkbox is checked", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: null });
    vi.mocked(rejectionApi.rejectApplication).mockResolvedValue({
      application: buildApplicationDetail({ status: "rejected" }),
      notification: null,
    });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Reject Candidate" }));
    await userEvent.click(screen.getByLabelText("Send rejection email"));
    const dialogButtons = await screen.findAllByRole("button", { name: "Reject Candidate" });
    await userEvent.click(dialogButtons[dialogButtons.length - 1]!);

    await waitFor(() => expect(rejectionApi.rejectApplication).toHaveBeenCalledWith("application-1-public", { send_email: true }));
  });

  // 13. double submit prevented
  it("disables Send Offer while a send is pending, preventing a double submit", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
    vi.mocked(offersApi.sendOffer).mockReturnValue(new Promise(() => {}));
    renderSection();

    const button = await screen.findByRole("button", { name: "Send Offer" });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  // 14. safe errors
  it("shows a safe message (never a raw error) when sending fails", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
    vi.mocked(offersApi.sendOffer).mockRejectedValue(new ApiError("raw smtp stack trace", 500));
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Send Offer" }));
    expect(await screen.findByText("Offer email could not be sent.")).toBeInTheDocument();
    expect(screen.queryByText(/raw smtp stack trace/)).not.toBeInTheDocument();
  });

  // 15. internal notes never shown anywhere in this section
  it("never renders internal_notes anywhere in the offer section", async () => {
    vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({
      offer: buildOffer({ status: "sent", internal_notes: "Candidate negotiated a signing bonus" }),
    });
    const { container } = renderSection();
    await screen.findByText("Sent");
    expect(container.textContent).not.toMatch(/negotiated a signing bonus/);
  });

  // Bug fix: Send Offer used to leave a stale "Not sent" label because
  // notification refetching was gated on offer.status === "sent" (a stale
  // closure at the moment handleSend ran). Fixed by gating on offer.id
  // instead — see OfferDecisionSection.tsx's own doc comment.
  describe("candidate email state after Send Offer (bug fix)", () => {
    // 6. Send Offer response/UI refetches notification state
    it("6. refetches offer notifications immediately after a successful Send Offer", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
      vi.mocked(offersApi.sendOffer).mockResolvedValue({ notification: buildOfferNotification({ status: "sent" }) });
      renderSection();

      await screen.findByRole("button", { name: "Send Offer" });
      vi.mocked(offersApi.listOfferNotifications).mockClear();

      await userEvent.click(screen.getByRole("button", { name: "Send Offer" }));

      await waitFor(() => expect(offersApi.listOfferNotifications).toHaveBeenCalledWith("offer-1-public", expect.anything()));
    });

    // 7. no stale Not sent after successful Send action
    it("7. never shows a stale Not sent label once the offer becomes sent", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
      vi.mocked(offersApi.listOfferNotifications).mockResolvedValue({
        notifications: [buildOfferNotification({ status: "sent", sent_at: "2026-01-02T10:00:00.000Z" })],
      });
      renderSection();

      expect(await screen.findByText(/Sent/)).toBeInTheDocument();
      expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    });

    it("shows the sent timestamp alongside Sent", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
      vi.mocked(offersApi.listOfferNotifications).mockResolvedValue({
        notifications: [buildOfferNotification({ status: "sent", sent_at: "2026-01-02T10:00:00.000Z" })],
      });
      renderSection();

      expect(await screen.findByText(/Sent Jan 2, 2026/)).toBeInTheDocument();
    });

    it("shows a Loading state instead of Not sent while notifications are still being fetched", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
      vi.mocked(offersApi.listOfferNotifications).mockReturnValue(new Promise(() => {}));
      renderSection();

      await screen.findByText("Sent"); // the offer-status badge, resolves immediately
      expect(screen.getByText("Loading…")).toBeInTheDocument();
      expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    });

    // 11. legacy sent Offer with no notification handled explicitly/safely
    it("11. shows Email status unavailable (never Not sent) for a sent offer with no notification history", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
      vi.mocked(offersApi.listOfferNotifications).mockResolvedValue({ notifications: [] });
      renderSection();

      expect(await screen.findByText("Email status unavailable")).toBeInTheDocument();
      expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    });

    // 4/5. SMTP failure -> Failed + Retry, without reverting the offer
    it("shows Failed + Retry Email and keeps the offer marked Sent when delivery failed", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
      vi.mocked(offersApi.listOfferNotifications).mockResolvedValue({
        notifications: [buildOfferNotification({ status: "failed", failure_code: "delivery_failed" })],
      });
      renderSection();

      expect(await screen.findByText("Failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry Email" })).toBeInTheDocument();
      // The Offer itself is still "Sent" — a delivery failure never reverts it.
      expect(screen.getByText("Sent")).toBeInTheDocument();
    });

    // 8. Retry failed notification -> Sent
    it("8. shows Sent after successfully retrying a failed notification", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "sent" }) });
      vi.mocked(offersApi.listOfferNotifications)
        .mockResolvedValueOnce({ notifications: [buildOfferNotification({ id: "notif-1", status: "failed" })] })
        .mockResolvedValueOnce({ notifications: [buildOfferNotification({ id: "notif-1", status: "sent", sent_at: "2026-01-02T10:00:00.000Z" })] });
      vi.mocked(offersApi.retryOfferNotification).mockResolvedValue({ notification: buildOfferNotification({ id: "notif-1", status: "sent" }) });
      const { container } = renderSection();

      await userEvent.click(await screen.findByRole("button", { name: "Retry Email" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Retry Email" })).not.toBeInTheDocument());
      expect(container.textContent).toMatch(/Sent Jan 2, 2026/);
    });

    // 13 (double-submit) reconfirmed specifically for the Candidate Email
    // area: the Send button disables immediately, before any notification
    // state is known.
    it("9. disables Send Offer immediately on click, before notification state resolves", async () => {
      vi.mocked(offersApi.getCurrentOfferForApplication).mockResolvedValue({ offer: buildOffer({ status: "draft" }) });
      vi.mocked(offersApi.sendOffer).mockReturnValue(new Promise(() => {}));
      renderSection();

      const button = await screen.findByRole("button", { name: "Send Offer" });
      await userEvent.click(button);

      expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
      expect(offersApi.sendOffer).toHaveBeenCalledTimes(1);
    });
  });
});
