import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLoginActions } from "@/hooks/useLoginActions";
import { cn } from "@/lib/utils";

interface UserProfileProps {
  className?: string;
  showLogout?: boolean;
}

export function UserProfile({ className, showLogout = true }: UserProfileProps) {
  const { user, metadata } = useCurrentUser();
  const { logout } = useLoginActions();

  if (!user) {
    return null;
  }

  const displayName = metadata?.name || metadata?.display_name || shortenPubkey(user.pubkey);
  const picture = metadata?.picture;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        {picture ? (
          <img
            src={picture}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
        )}
        <span className="text-sm font-medium truncate max-w-[120px]">
          {displayName}
        </span>
      </div>

      {showLogout && (
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="h-8 w-8"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

function shortenPubkey(pubkey: string): string {
  if (pubkey.length <= 12) return pubkey;
  return `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`;
}
