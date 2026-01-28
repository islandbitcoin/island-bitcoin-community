import { memo, useRef, useEffect } from "react";
import type { NostrEvent } from "@nostrify/nostrify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, RefreshCw, Loader2 } from "lucide-react";
import { useNostrFeed } from "@/hooks/useNostrFeed";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { Button } from "@/components/ui/button";

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface PostItemProps {
  event: NostrEvent;
}

const PostItem = memo(function PostItem({ event }: PostItemProps) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(event.pubkey);

  return (
    <div className="flex gap-3 p-3 border-b border-border last:border-b-0">
      <Avatar className="h-10 w-10 flex-shrink-0">
        {metadata?.picture && <AvatarImage src={metadata.picture} />}
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayName}</span>
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(event.created_at)}
          </span>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap break-words">
          {event.content}
        </p>
      </div>
    </div>
  );
});

export const NostrFeed = memo(function NostrFeed() {
  const { posts, isLoading, isError, refetch, loadMore, hasMore, isLoadingMore } = useNostrFeed({ limit: 50 });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !isLoadingMore) {
        loadMore();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Feed
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">Loading feed...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center">
            <p className="text-destructive">Error loading feed</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">No community posts found</p>
            {hasMore && (
              <Button variant="outline" size="sm" className="mt-2" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Search older posts
              </Button>
            )}
          </div>
        ) : (
          <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
            {posts.map((post) => (
              <PostItem key={post.id} event={post} />
            ))}
            {isLoadingMore && (
              <div className="p-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            {hasMore && !isLoadingMore && (
              <div className="p-4 text-center">
                <Button variant="ghost" size="sm" onClick={loadMore}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
