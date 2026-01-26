import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface AdminConfig {
  maxDailyPayout: number;
  maxPayoutPerUser: number;
  minWithdrawal: number;
  withdrawalFee: number;
  gameRewards: {
    triviaEasy: number;
    triviaMedium: number;
    triviaHard: number;
    dailyChallenge: number;
    achievementBonus: number;
    referralBonus: number;
  };
  rateLimits: {
    triviaPerHour: number;
    withdrawalsPerDay: number;
    maxStreakBonus: number;
  };
  adminPubkeys: string[];
  maintenanceMode: boolean;
  gameVisibility: {
    satoshiStacker: boolean;
  };
  pullPaymentId?: string;
  btcPayServerUrl?: string;
  btcPayStoreId?: string;
  btcPayApiKey?: string;
  oryToken?: string;
  autoApprove: boolean;
  autoApproveThreshold: number;
}

interface RawConfig {
  [key: string]: string;
}

function parseConfig(raw: RawConfig): AdminConfig {
  const parseNumber = (val: string | undefined, defaultVal: number) => {
    const num = parseInt(val || "", 10);
    return isNaN(num) ? defaultVal : num;
  };

  const parseBoolean = (val: string | undefined, defaultVal: boolean) => {
    if (val === "true") return true;
    if (val === "false") return false;
    return defaultVal;
  };

  const parseArray = (val: string | undefined): string[] => {
    try {
      const parsed = JSON.parse(val || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    maxDailyPayout: parseNumber(raw.maxDailyPayout, 10000),
    maxPayoutPerUser: parseNumber(raw.maxPayoutPerUser, 5000),
    minWithdrawal: parseNumber(raw.minWithdrawal, 100),
    withdrawalFee: parseNumber(raw.withdrawalFee, 0),
    gameRewards: {
      triviaEasy: parseNumber(raw.triviaEasy, 10),
      triviaMedium: parseNumber(raw.triviaMedium, 25),
      triviaHard: parseNumber(raw.triviaHard, 50),
      dailyChallenge: parseNumber(raw.dailyChallenge, 100),
      achievementBonus: parseNumber(raw.achievementBonus, 50),
      referralBonus: parseNumber(raw.referralBonus, 100),
    },
    rateLimits: {
      triviaPerHour: parseNumber(raw.triviaPerHour, 10),
      withdrawalsPerDay: parseNumber(raw.withdrawalsPerDay, 5),
      maxStreakBonus: parseNumber(raw.maxStreakBonus, 500),
    },
    adminPubkeys: parseArray(raw.adminPubkeys),
    maintenanceMode: parseBoolean(raw.maintenanceMode, false),
    gameVisibility: {
      satoshiStacker: parseBoolean(raw.satoshiStacker, true),
    },
    pullPaymentId: raw.pullPaymentId || undefined,
    btcPayServerUrl: raw.btcPayServerUrl || undefined,
    btcPayStoreId: raw.btcPayStoreId || undefined,
    btcPayApiKey: raw.btcPayApiKey || undefined,
    oryToken: raw.ory_token || undefined,
    autoApprove: parseBoolean(raw.autoApprove, false),
    autoApproveThreshold: parseNumber(raw.autoApproveThreshold, 100),
  };
}

async function fetchConfig(pubkey: string): Promise<RawConfig> {
  const response = await fetch(`${API_BASE}/config`, {
    headers: {
      Authorization: `Nostr ${pubkey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch config");
  }

  return response.json();
}

async function updateConfigApi(
  pubkey: string,
  updates: Record<string, unknown>
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Nostr ${pubkey}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error("Failed to update config");
  }

  return response.json();
}

export function useAdminConfig() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const {
    data: rawConfig,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-config", user?.pubkey],
    queryFn: () => fetchConfig(user!.pubkey),
    enabled: !!user?.pubkey,
    staleTime: 30 * 1000,
  });

  const config = useMemo(() => {
    if (!rawConfig) return null;
    return parseConfig(rawConfig);
  }, [rawConfig]);

  const isAdmin = useMemo(() => {
    if (!config || !user) return false;
    return config.adminPubkeys.includes(user.pubkey);
  }, [config, user]);

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      updateConfigApi(user!.pubkey, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-config", user?.pubkey] });
    },
  });

  const updateConfig = useCallback(
    async (updates: Partial<AdminConfig>) => {
      const flatUpdates: Record<string, unknown> = {};

      if (updates.maxDailyPayout !== undefined) {
        flatUpdates.maxDailyPayout = updates.maxDailyPayout;
      }
      if (updates.maxPayoutPerUser !== undefined) {
        flatUpdates.maxPayoutPerUser = updates.maxPayoutPerUser;
      }
      if (updates.minWithdrawal !== undefined) {
        flatUpdates.minWithdrawal = updates.minWithdrawal;
      }
      if (updates.withdrawalFee !== undefined) {
        flatUpdates.withdrawalFee = updates.withdrawalFee;
      }
      if (updates.maintenanceMode !== undefined) {
        flatUpdates.maintenanceMode = updates.maintenanceMode;
      }
      if (updates.gameRewards) {
        if (updates.gameRewards.triviaEasy !== undefined) {
          flatUpdates.triviaEasy = updates.gameRewards.triviaEasy;
        }
        if (updates.gameRewards.triviaMedium !== undefined) {
          flatUpdates.triviaMedium = updates.gameRewards.triviaMedium;
        }
        if (updates.gameRewards.triviaHard !== undefined) {
          flatUpdates.triviaHard = updates.gameRewards.triviaHard;
        }
        if (updates.gameRewards.dailyChallenge !== undefined) {
          flatUpdates.dailyChallenge = updates.gameRewards.dailyChallenge;
        }
        if (updates.gameRewards.achievementBonus !== undefined) {
          flatUpdates.achievementBonus = updates.gameRewards.achievementBonus;
        }
        if (updates.gameRewards.referralBonus !== undefined) {
          flatUpdates.referralBonus = updates.gameRewards.referralBonus;
        }
      }
      if (updates.rateLimits) {
        if (updates.rateLimits.triviaPerHour !== undefined) {
          flatUpdates.triviaPerHour = updates.rateLimits.triviaPerHour;
        }
        if (updates.rateLimits.withdrawalsPerDay !== undefined) {
          flatUpdates.withdrawalsPerDay = updates.rateLimits.withdrawalsPerDay;
        }
        if (updates.rateLimits.maxStreakBonus !== undefined) {
          flatUpdates.maxStreakBonus = updates.rateLimits.maxStreakBonus;
        }
      }
      if (updates.gameVisibility) {
        if (updates.gameVisibility.satoshiStacker !== undefined) {
          flatUpdates.satoshiStacker = updates.gameVisibility.satoshiStacker;
        }
      }
      if (updates.adminPubkeys !== undefined) {
        flatUpdates.adminPubkeys = updates.adminPubkeys;
      }
      if (updates.pullPaymentId !== undefined) {
        flatUpdates.pullPaymentId = updates.pullPaymentId;
      }
      if (updates.btcPayServerUrl !== undefined) {
        flatUpdates.btcPayServerUrl = updates.btcPayServerUrl;
      }
      if (updates.btcPayStoreId !== undefined) {
        flatUpdates.btcPayStoreId = updates.btcPayStoreId;
      }
      if (updates.btcPayApiKey !== undefined) {
        flatUpdates.btcPayApiKey = updates.btcPayApiKey;
      }
      if (updates.oryToken !== undefined) {
        flatUpdates.ory_token = updates.oryToken;
      }
      if (updates.autoApprove !== undefined) {
        flatUpdates.autoApprove = updates.autoApprove;
      }
      if (updates.autoApproveThreshold !== undefined) {
        flatUpdates.autoApproveThreshold = updates.autoApproveThreshold;
      }

      return updateMutation.mutateAsync(flatUpdates);
    },
    [updateMutation]
  );

  const refreshConfig = useCallback(() => {
    if (user?.pubkey) {
      queryClient.invalidateQueries({ queryKey: ["admin-config", user.pubkey] });
    }
  }, [user?.pubkey, queryClient]);

  return {
    config,
    rawConfig,
    isLoading,
    error,
    isAdmin,
    updateConfig,
    refreshConfig,
    isUpdating: updateMutation.isPending,
  };
}
