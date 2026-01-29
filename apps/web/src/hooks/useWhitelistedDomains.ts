import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface PublicConfig {
  whitelistedDomains: string[];
  communityPubkeys: string[];
}

export function useWhitelistedDomains() {
  const { data, isLoading } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/config/public`);
      if (!response.ok) {
        return { whitelistedDomains: [], communityPubkeys: [] };
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    whitelistedDomains: data?.whitelistedDomains || [],
    communityPubkeys: data?.communityPubkeys || [],
    isLoading,
  };
}
