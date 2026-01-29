import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { createNIP98AuthHeader } from "@/lib/nip98";
import type { UserBalance } from "@island-bitcoin/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchBalance(): Promise<UserBalance> {
  const apiPath = `${API_BASE}/wallet/balance`;
  const nip98Url = apiPath.startsWith("http")
    ? apiPath
    : `${window.location.origin}${apiPath}`;
  const authHeader = await createNIP98AuthHeader(nip98Url, "GET");

  const response = await fetch(apiPath, {
    headers: {
      Authorization: authHeader,
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
    queryFn: () => fetchBalance(),
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
