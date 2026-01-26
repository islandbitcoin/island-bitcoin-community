import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import type { UserBalance } from "@island-bitcoin/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchBalance(pubkey: string): Promise<UserBalance> {
  const response = await fetch(`${API_BASE}/wallet/balance`, {
    headers: {
      Authorization: `Nostr ${pubkey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch balance");
  }

  return response.json();
}

export function useGameWallet() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const {
    data: balance,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["wallet-balance", user?.pubkey],
    queryFn: () => fetchBalance(user!.pubkey),
    enabled: !!user?.pubkey,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const refreshBalance = useCallback(() => {
    if (user?.pubkey) {
      queryClient.invalidateQueries({ queryKey: ["wallet-balance", user.pubkey] });
    }
  }, [user?.pubkey, queryClient]);

  return {
    balance,
    isLoading,
    error,
    refreshBalance,
  };
}
