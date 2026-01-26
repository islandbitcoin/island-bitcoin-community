import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface GalleryImage {
  url: string;
  type: string;
  uploaded: number;
}

async function fetchGallery(): Promise<GalleryImage[]> {
  const response = await fetch(`${API_BASE}/gallery`);

  if (!response.ok) {
    throw new Error("Failed to fetch gallery");
  }

  return response.json();
}

export function useGallery() {
  const queryClient = useQueryClient();

  const {
    data: images,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["gallery"],
    queryFn: fetchGallery,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["gallery"] });
  }, [queryClient]);

  return {
    images: images ?? [],
    isLoading,
    error: error as Error | null,
    refresh,
  };
}
