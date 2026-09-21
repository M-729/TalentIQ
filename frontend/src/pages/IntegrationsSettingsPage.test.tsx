import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { IntegrationsSettingsPage } from "@/pages/IntegrationsSettingsPage";
import * as googleCalendarApi from "@/services/api/googleCalendarIntegration";

vi.mock("@/services/api/googleCalendarIntegration");

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/settings/integrations", element: <IntegrationsSettingsPage /> }], {
    initialEntries: [path],
  });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

describe("IntegrationsSettingsPage", () => {
  beforeEach(() => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockReset().mockResolvedValue({ connected: false });
  });

  it("renders the Google Calendar integration card", async () => {
    renderAt("/settings/integrations");
    expect(await screen.findByText("Google Calendar")).toBeInTheDocument();
  });

  it("shows a success banner and refreshes status on ?googleCalendar=connected", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValueOnce({ connected: false }).mockResolvedValueOnce({
      connected: true,
      account_email: "alice@gmail.com",
      calendar_permission_granted: true,
    });
    renderAt("/settings/integrations?googleCalendar=connected");

    expect(await screen.findByText("Google Calendar connected successfully.")).toBeInTheDocument();
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });

  it("shows a safe failure banner on ?googleCalendar=error, never exposing OAuth code/state/raw error", async () => {
    renderAt("/settings/integrations?googleCalendar=error&code=raw-auth-code&state=raw-state-value");

    expect(await screen.findByText("Google Calendar could not be connected. Please try again.")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("raw-auth-code");
    expect(text).not.toContain("raw-state-value");
  });

  it("shows no banner when there is no googleCalendar query param", async () => {
    renderAt("/settings/integrations");
    await screen.findByText("Google Calendar");
    expect(screen.queryByText("Google Calendar connected successfully.")).not.toBeInTheDocument();
    expect(screen.queryByText("Google Calendar could not be connected. Please try again.")).not.toBeInTheDocument();
  });

  it("cleans up the googleCalendar query param after handling it", async () => {
    const { router } = renderAt("/settings/integrations?googleCalendar=connected");
    await screen.findByText("Google Calendar connected successfully.");
    expect(router.state.location.search).not.toContain("googleCalendar");
  });
});
