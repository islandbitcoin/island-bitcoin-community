import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import { useMemo } from "react";

interface UseNostrFeedOptions {
  limit: number;
}

interface FeedData {
  posts: NostrEvent[];
}

export function useNostrFeed({ limit }: UseNostrFeedOptions) {
  const { nostr } = useNostr();

  const { data, isLoading, isError, refetch } = useQuery<FeedData>({
    queryKey: ["nostr-feed", limit],
    queryFn: async ({ signal }) => {
      const posts = await nostr.query([{ kinds: [1], limit }], { signal });

      return { posts };
    },
    staleTime: 5 * 60 * 1000,
  });

  const sortedPosts = useMemo(() => {
    if (!data?.posts) return [];
    return [...data.posts].sort((a, b) => b.created_at - a.created_at);
  }, [data?.posts]);

  return {
    posts: sortedPosts,
    isLoading,
    isError,
    refetch,
  };
}
