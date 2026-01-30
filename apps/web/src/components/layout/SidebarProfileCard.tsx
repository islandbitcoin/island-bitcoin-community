import { LogOut, User, Zap } from "lucide-react";
import { nip19 } from "nostr-tools";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLoginActions } from "@/hooks/useLoginActions";

export function SidebarProfileCard() {
  const { user, metadata } = useCurrentUser();
  const { logout } = useLoginActions();

  if (!user) {
    return null;
  }

  const npub = nip19.npubEncode(user.pubkey);
  const truncatedNpub = `${npub.slice(0, 10)}...${npub.slice(-4)}`;

  const displayName = metadata?.display_name || metadata?.name || truncatedNpub;
  const picture = metadata?.picture;
  const about = metadata?.about;
  const lud16 = metadata?.lud16;

  const isLoading = !metadata;

  if (isLoading) {
    return (
      <div className="p-4 border-b border-border">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
          <div className="w-32 h-5 bg-muted animate-pulse rounded" />
          <div className="w-40 h-4 bg-muted animate-pulse rounded" />
          <div className="w-full space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded" />
            <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-border">
      <div className="flex flex-col items-center gap-3">
        {picture ? (
          <img
            src={picture}
            alt={displayName}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
        )}

        <div className="text-center">
          <h3 className="text-lg font-bold">{displayName}</h3>
          <p className="text-sm text-muted-foreground">{truncatedNpub}</p>
        </div>

        {about && (
          <p className="text-sm text-muted-foreground text-center line-clamp-3 w-full">
            {about}
          </p>
        )}

        {lud16 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="truncate max-w-[200px]">{lud16}</span>
          </div>
        )}

        <Button
          variant="outline"
          onClick={logout}
          className="w-full mt-2"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
