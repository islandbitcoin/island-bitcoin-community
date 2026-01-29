import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockUser = { pubkey: "admin-pubkey-123" };
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: mockUser,
  })),
}));

import Admin from "../Admin";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
};

const mockConfig = {
  maxDailyPayout: "10000",
  maxPayoutPerUser: "5000",
  minWithdrawal: "100",
  triviaEasy: "10",
  triviaMedium: "25",
  triviaHard: "50",
  dailyChallenge: "100",
  achievementBonus: "50",
  referralBonus: "100",
  triviaPerHour: "10",
  adminPubkeys: JSON.stringify(["admin-pubkey-123"]),
  maintenanceMode: "false",
  pullPaymentId: "",
  btcPayServerUrl: "",
};

describe("Admin Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should render the page title when user is admin", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /game wallet admin/i })).toBeInTheDocument();
    });
  });

  it("should show access denied when user is not admin", async () => {
    const configWithoutUser = {
      ...mockConfig,
      adminPubkeys: JSON.stringify(["other-pubkey"]),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(configWithoutUser),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });

  it("should show loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("should render all 6 tabs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /rewards/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("tab", { name: /limits/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /payouts/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /admins/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /games/i })).toBeInTheDocument();
  });

  it("should display statistics card", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/today's statistics/i)).toBeInTheDocument();
    });
  });

  it("should switch tabs when clicked", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /limits/i })).toBeInTheDocument();
    });

    const limitsTab = screen.getByRole("tab", { name: /limits/i });
    await user.click(limitsTab);

    expect(limitsTab).toHaveAttribute("data-state", "active");
    expect(screen.getByText(/payout limits/i)).toBeInTheDocument();
  });

  it("should display rewards configuration in rewards tab", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/trivia - easy/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/trivia - medium/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trivia - hard/i)).toBeInTheDocument();
  });

  it("should display admin list in admins tab", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /admins/i })).toBeInTheDocument();
    });

    const adminsTab = screen.getByRole("tab", { name: /admins/i });
    await user.click(adminsTab);

    expect(screen.getByText(/admin management/i)).toBeInTheDocument();
    expect(screen.getByText(/admin-pubkey-123/i)).toBeInTheDocument();
  });

  it("should show return home link when access denied", async () => {
    const configWithoutUser = {
      ...mockConfig,
      adminPubkeys: JSON.stringify(["other-pubkey"]),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(configWithoutUser),
    });

    const Wrapper = createWrapper();
    render(<Admin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /return home/i })).toBeInTheDocument();
    });
  });

  describe("Flash API Configuration (Pull Payments Tab)", () => {
    it("should display Flash API token input field (masked)", async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const tokenInput = screen.getByLabelText(/flash api token/i);
      expect(tokenInput).toBeInTheDocument();
      expect(tokenInput).toHaveAttribute("type", "password");
    });

    it("should display auto-approve toggle", async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      expect(screen.getByRole("switch", { name: /auto-approve/i })).toBeInTheDocument();
    });

    it("should display auto-approve threshold input", async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const thresholdInput = screen.getByLabelText(/auto-approve threshold/i);
      expect(thresholdInput).toBeInTheDocument();
      expect(thresholdInput).toHaveAttribute("type", "number");
    });

    it("should display batch approve button", async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      expect(screen.getByRole("button", { name: /process pending payouts/i })).toBeInTheDocument();
    });

    it("should save Flash API token when form is submitted", async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const tokenInput = screen.getByLabelText(/flash api token/i);
      await user.clear(tokenInput);
      await user.type(tokenInput, "test-ory-token-123");

      const saveButton = screen.getByRole("button", { name: /save flash api configuration/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/config"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("ory_token"),
          })
        );
      });
    });

    it("should toggle auto-approve and save", async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...mockConfig, autoApprove: "true" }),
        });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const autoApproveSwitch = screen.getByRole("switch", { name: /auto-approve/i });
      await user.click(autoApproveSwitch);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/config"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("autoApprove"),
          })
        );
      });
    });

    it("should call batch process endpoint when button is clicked", async () => {
      const user = userEvent.setup();

      vi.spyOn(window, "confirm").mockReturnValue(true);

      const configWithToken = {
        ...mockConfig,
        ory_token: "configured",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(configWithToken),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processed: 5, succeeded: 4, failed: 1 }),
        });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const batchButton = screen.getByRole("button", { name: /process pending payouts/i });
      await user.click(batchButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/admin/payouts/process"),
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("should show processing results after batch approve", async () => {
      const user = userEvent.setup();

      vi.spyOn(window, "confirm").mockReturnValue(true);

      const configWithToken = {
        ...mockConfig,
        ory_token: "configured",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(configWithToken),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processed: 5, succeeded: 4, failed: 1 }),
        });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const batchButton = screen.getByRole("button", { name: /process pending payouts/i });
      await user.click(batchButton);

      await waitFor(() => {
        expect(screen.getByText(/4 succeeded/i)).toBeInTheDocument();
        expect(screen.getByText(/1 failed/i)).toBeInTheDocument();
      });
    });

    it("should show configured status when ory_token is set", async () => {
      const user = userEvent.setup();

      const configWithToken = {
        ...mockConfig,
        ory_token: "configured", // API returns "configured" not actual token
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(configWithToken),
      });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      expect(screen.getByText(/flash api is configured/i)).toBeInTheDocument();
    });

    it("should validate threshold is positive number", async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const Wrapper = createWrapper();
      render(<Admin />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /pull payments/i })).toBeInTheDocument();
      });

      const pullPaymentsTab = screen.getByRole("tab", { name: /pull payments/i });
      await user.click(pullPaymentsTab);

      const thresholdInput = screen.getByLabelText(/auto-approve threshold/i);
      expect(thresholdInput).toHaveAttribute("min", "1");
    });
  });
});
