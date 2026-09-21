import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoogleCalendarIntegrationCard } from "@/components/settings/GoogleCalendarIntegrationCard";
import { ApiError } from "@/services/api/client";
import * as googleCalendarApi from "@/services/api/googleCalendarIntegration";

vi.mock("@/services/api/googleCalendarIntegration");

const originalAssign = window.location.assign;

describe("GoogleCalendarIntegrationCard", () => {
  beforeEach(() => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockReset();
    vi.mocked(googleCalendarApi.getGoogleCalendarConnectUrl).mockReset();
    vi.mocked(googleCalendarApi.disconnectGoogleCalendar).mockReset();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: { ...window.location, assign: originalAssign }, writable: true });
  });

  it("shows the disconnected state with a Connect button", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: false });
    render(<GoogleCalendarIntegrationCard />);

    expect(await screen.findByText("Connect Google Calendar to create interview events and Google Meet links.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeInTheDocument();
  });

  it("fetches the connect URL and performs a top-level browser navigation to it when Connect is clicked", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: false });
    vi.mocked(googleCalendarApi.getGoogleCalendarConnectUrl).mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/consent" });
    render(<GoogleCalendarIntegrationCard />);

    await userEvent.click(await screen.findByRole("button", { name: "Connect Google Calendar" }));

    await waitFor(() => expect(googleCalendarApi.getGoogleCalendarConnectUrl).toHaveBeenCalled());
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/consent"));
  });

  it("shows the connected account state with email and connected date", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({
      connected: true,
      account_email: "alice@gmail.com",
      connected_at: "2024-01-15T00:00:00.000Z",
      calendar_permission_granted: true,
    });
    render(<GoogleCalendarIntegrationCard />);

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("alice@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("requires confirmation before disconnecting", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({
      connected: true,
      account_email: "alice@gmail.com",
      calendar_permission_granted: true,
    });
    render(<GoogleCalendarIntegrationCard />);

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    expect(await screen.findByRole("heading", { name: "Disconnect Google Calendar?" })).toBeInTheDocument();
    expect(googleCalendarApi.disconnectGoogleCalendar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(googleCalendarApi.disconnectGoogleCalendar).toHaveBeenCalled());
  });

  it("never renders any token/secret-looking data", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({
      connected: true,
      account_email: "alice@gmail.com",
      connected_at: "2024-01-15T00:00:00.000Z",
      calendar_permission_granted: true,
    });
    render(<GoogleCalendarIntegrationCard />);

    await screen.findByText("Connected");
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/refresh_token|access_token|client_secret|ciphertext/i);
  });

  // ===== SCOPE HEALTH =====
  describe("Calendar permission health", () => {
    it("shows the connection as ready when the required Calendar permission is present", async () => {
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({
        connected: true,
        account_email: "alice@gmail.com",
        calendar_permission_granted: true,
      });
      render(<GoogleCalendarIntegrationCard />);

      expect(await screen.findByText("Connected")).toBeInTheDocument();
      expect(screen.queryByText("Calendar permission needed")).not.toBeInTheDocument();
    });

    it("shows a reconnect/permission warning when the required Calendar permission is missing", async () => {
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({
        connected: true,
        account_email: "alice@gmail.com",
        calendar_permission_granted: false,
      });
      render(<GoogleCalendarIntegrationCard />);

      expect(await screen.findByText("Calendar permission needed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reconnect Google Calendar" })).toBeInTheDocument();
    });

    it("never presents a connection missing the Calendar permission as fully healthy ('Connected' success state)", async () => {
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({
        connected: true,
        account_email: "alice@gmail.com",
        calendar_permission_granted: false,
      });
      render(<GoogleCalendarIntegrationCard />);

      await screen.findByText("Calendar permission needed");
      // The plain "Connected" success heading is reserved for the fully
      // healthy state only.
      expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    });
  });

  it("shows a safe error message and Retry on a status load failure, never a raw backend message", async () => {
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockRejectedValue(new ApiError("raw db error", 500));
    render(<GoogleCalendarIntegrationCard />);

    expect(await screen.findByText("Google Calendar connection status could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db error/)).not.toBeInTheDocument();
  });
});
