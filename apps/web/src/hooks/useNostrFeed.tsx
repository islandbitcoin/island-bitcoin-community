import { useNostr } from "@nostrify/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import { useMemo, useCallback } from "react";
import { useWhitelistedDomains } from "./useWhitelistedDomains";

interface UseNostrFeedOptions {
  limit: number;
}

const BATCH_SIZE = 100;

export function useNostrFeed({ limit }: UseNostrFeedOptions) {
  const { nostr } = useNostr();
  const { communityPubkeys, isLoading: isConfigLoading } = useWhitelistedDomains();

  const hasCommunityMembers = communityPubkeys.length > 0;

  const {
    data,
    isLoading: isFeedLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["nostr-feed-community", communityPubkeys],
    queryFn: async ({ signal, pageParam }) => {
      if (hasCommunityMembers) {
        const posts = await nostr.query(
          [{ kinds: [1], authors: communityPubkeys, limit: BATCH_SIZE, ...(pageParam ? { until: pageParam } : {}) }],
          { signal }
        );
        return posts as NostrEvent[];
      }
      const posts = await nostr.query(
        [{ kinds: [1], limit: BATCH_SIZE, ...(pageParam ? { until: pageParam } : {}) }],
        { signal }
      );
      return posts as NostrEvent[];
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < BATCH_SIZE) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest ? oldest.created_at - 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isConfigLoading,
  });

  const sortedPosts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flat().sort((a, b) => b.created_at - a.created_at).slice(0, limit);
  }, [data?.pages, limit]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    posts: sortedPosts,
    isLoading: isFeedLoading || isConfigLoading,
    isError,
    refetch,
    loadMore,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
  };
}
