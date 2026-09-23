import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from "react-router-dom";
import { OfferResponsePage } from "@/pages/OfferResponsePage";
import * as offerResponseApi from "@/services/api/offerResponse";
import type { OfferResponseResult } from "@/types/offerResponse";

vi.mock("@/services/api/offerResponse");

function buildResult(overrides: Partial<OfferResponseResult> = {}): OfferResponseResult {
  return {
    response_state: "awaiting_response",
    company_name: "Demo Company",
    job_title: "Frontend Junior",
    offer_title: "Frontend Junior Offer",
    salary_amount: 1000,
    salary_currency: "USD",
    employment_type: "Full-time",
    start_date: "2026-10-12T00:00:00.000Z",
    expires_at: null,
    candidate_message: null,
    ...overrides,
  };
}

function renderAt(hash: string) {
  return render(
    <MemoryRouter initialEntries={[`/offer-response${hash}`]}>
      <Routes>
        <Route path="/offer-response" element={<OfferResponsePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OfferResponsePage", () => {
  beforeEach(() => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockReset();
    vi.mocked(offerResponseApi.respondToOfferResponse).mockReset();
  });

  // 8. Accept intent displays confirmation
  it("8. shows the Accept confirmation for decision=accept", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=accept");

    expect(await screen.findByText("Accept offer?")).toBeInTheDocument();
    expect(screen.getByText(/You're confirming that you accept the offer for Frontend Junior at Demo Company/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm acceptance" })).toBeInTheDocument();
  });

  // 9. Decline intent displays confirmation
  it("9. shows the Decline confirmation for decision=decline", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=decline");

    expect(await screen.findByText("Decline offer?")).toBeInTheDocument();
    expect(screen.getByText("You're confirming that you do not wish to accept this offer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm decline" })).toBeInTheDocument();
  });

  // 10. page load does not call respond endpoint
  it("10. never calls respond on page load — only lookup", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=accept");

    await screen.findByText("Accept offer?");
    expect(offerResponseApi.lookupOfferResponse).toHaveBeenCalledWith("abc123");
    expect(offerResponseApi.respondToOfferResponse).not.toHaveBeenCalled();
  });

  // 11. Confirm Accept calls respond once
  it("11. calls respond with decision accepted exactly once on Confirm acceptance", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    vi.mocked(offerResponseApi.respondToOfferResponse).mockResolvedValue(buildResult({ response_state: "accepted" }));
    renderAt("#token=abc123&decision=accept");

    await userEvent.click(await screen.findByRole("button", { name: "Confirm acceptance" }));
    await waitFor(() => expect(offerResponseApi.respondToOfferResponse).toHaveBeenCalledWith("abc123", "accepted"));
    expect(offerResponseApi.respondToOfferResponse).toHaveBeenCalledTimes(1);
  });

  // 12. Confirm Decline calls respond once
  it("12. calls respond with decision declined exactly once on Confirm decline", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    vi.mocked(offerResponseApi.respondToOfferResponse).mockResolvedValue(buildResult({ response_state: "declined" }));
    renderAt("#token=abc123&decision=decline");

    await userEvent.click(await screen.findByRole("button", { name: "Confirm decline" }));
    await waitFor(() => expect(offerResponseApi.respondToOfferResponse).toHaveBeenCalledWith("abc123", "declined"));
    expect(offerResponseApi.respondToOfferResponse).toHaveBeenCalledTimes(1);
  });

  // 13. rapid double confirmation sends one mutation
  it("13. a rapid double click on Confirm acceptance sends only one mutation", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    vi.mocked(offerResponseApi.respondToOfferResponse).mockReturnValue(new Promise(() => {}));
    renderAt("#token=abc123&decision=accept");

    const button = await screen.findByRole("button", { name: "Confirm acceptance" });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(offerResponseApi.respondToOfferResponse).toHaveBeenCalledTimes(1);
  });

  // 14. accepted success state
  it("14. shows the accepted success message after confirming", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    vi.mocked(offerResponseApi.respondToOfferResponse).mockResolvedValue(buildResult({ response_state: "accepted" }));
    renderAt("#token=abc123&decision=accept");

    await userEvent.click(await screen.findByRole("button", { name: "Confirm acceptance" }));
    expect(await screen.findByText("Offer accepted")).toBeInTheDocument();
    expect(screen.getByText(/Thank you\. Your response has been recorded\./)).toBeInTheDocument();
    // Never claims the candidate is hired.
    expect(screen.queryByText(/hired/i)).not.toBeInTheDocument();
  });

  // 15. declined success state
  it("15. shows the declined success message after confirming", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    vi.mocked(offerResponseApi.respondToOfferResponse).mockResolvedValue(buildResult({ response_state: "declined" }));
    renderAt("#token=abc123&decision=decline");

    await userEvent.click(await screen.findByRole("button", { name: "Confirm decline" }));
    expect(await screen.findByText("Offer declined")).toBeInTheDocument();
    expect(screen.getByText("Your response has been recorded.")).toBeInTheDocument();
  });

  // 16. already accepted state
  it("16. shows an already-accepted message when the offer was already accepted before this page load", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult({ response_state: "accepted" }));
    renderAt("#token=abc123&decision=accept");

    expect(await screen.findByText("This offer has already been accepted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm acceptance" })).not.toBeInTheDocument();
  });

  // 17. already declined state
  it("17. shows an already-declined message when the offer was already declined before this page load", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult({ response_state: "declined" }));
    renderAt("#token=abc123&decision=decline");

    expect(await screen.findByText("This offer has already been declined.")).toBeInTheDocument();
  });

  // 18. withdrawn unavailable state
  it("18. shows a safe unavailable message for a withdrawn offer", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult({ response_state: "withdrawn" }));
    renderAt("#token=abc123&decision=accept");

    expect(await screen.findByText("This offer is no longer available.")).toBeInTheDocument();
  });

  // 19. expired state
  it("19. shows the expired message for an expired offer", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult({ response_state: "expired" }));
    renderAt("#token=abc123&decision=accept");

    expect(await screen.findByText("This offer has expired. Please contact the hiring team if you have questions.")).toBeInTheDocument();
  });

  // 20. invalid token safe state
  it("20. shows a safe invalid message for an invalid token, with no offer details", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue({ response_state: "invalid" });
    renderAt("#token=garbage&decision=accept");

    expect(await screen.findByText("This link is invalid or no longer available.")).toBeInTheDocument();
    expect(screen.queryByText("Demo Company")).not.toBeInTheDocument();
  });

  it("shows the same safe invalid state when the URL has no token at all", async () => {
    renderAt("");
    expect(await screen.findByText("This link is invalid or no longer available.")).toBeInTheDocument();
    expect(offerResponseApi.lookupOfferResponse).not.toHaveBeenCalled();
  });

  // Token must not linger in browser URL/history once captured (Part 4).
  it("removes the token from the URL/history after capturing it, without losing the offer context", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    const router = createMemoryRouter(
      [{ path: "/offer-response", element: <OfferResponsePage /> }],
      { initialEntries: ["/offer-response#token=abc123&decision=accept"] }
    );
    render(<RouterProvider router={router} />);

    // The page still correctly used the token for its lookup call...
    await screen.findByText("Accept offer?");
    expect(offerResponseApi.lookupOfferResponse).toHaveBeenCalledWith("abc123");

    // ...even though the hash is no longer present in the router's own
    // location/history once the page has captured it.
    await waitFor(() => expect(router.state.location.hash).toBe(""));
    expect(router.state.location.pathname).toBe("/offer-response");
  });

  // 21. no HR sidebar
  it("21. never renders HR navigation destinations", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=accept");

    await screen.findByText("Accept offer?");
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Applications" })).not.toBeInTheDocument();
  });

  // 22. TalentIQ public branding/navigation appropriate
  it("22. renders the TalentIQ public brand, linking to /careers, alongside Recruiter login", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=accept");

    await screen.findByText("Accept offer?");
    const brandLink = screen.getByRole("link", { name: /TalentIQ/ });
    expect(brandLink).toHaveAttribute("href", "/careers");
    const recruiterLoginLink = screen.getByRole("link", { name: "Recruiter login" });
    expect(recruiterLoginLink).toHaveAttribute("href", "/login");
  });

  // 23. no candidate account prompt
  it("23. never prompts for a candidate account/login", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=accept");

    await screen.findByText("Accept offer?");
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
  });

  it("shows offer context (job, company, salary, start date) alongside the confirmation", async () => {
    vi.mocked(offerResponseApi.lookupOfferResponse).mockResolvedValue(buildResult());
    renderAt("#token=abc123&decision=accept");

    await screen.findByText("Accept offer?");
    expect(screen.getByText("Demo Company")).toBeInTheDocument();
    expect(screen.getByText("Frontend Junior")).toBeInTheDocument();
    expect(screen.getByText(/1,000 USD/)).toBeInTheDocument();
    expect(screen.getByText(/Oct 12, 2026/)).toBeInTheDocument();
  });
});
