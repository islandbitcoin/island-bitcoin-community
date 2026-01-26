import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Heart,
  MessageSquare,
  Repeat,
  Zap,
  Check,
  Trash2,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

interface NotificationItemProps {
  id: string;
  type: "mention" | "reply" | "like" | "repost" | "zap";
  pubkey: string;
  content?: string;
  timestamp: number;
  read: boolean;
  onMarkRead: () => void;
}

const NotificationItem = memo(function NotificationItem({
  type,
  pubkey,
  content,
  timestamp,
  read,
  onMarkRead,
}: NotificationItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(pubkey);

  const getIcon = () => {
    switch (type) {
      case "mention":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "reply":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />;
      case "repost":
        return <Repeat className="h-4 w-4 text-purple-500" />;
      case "zap":
        return <Zap className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getMessage = () => {
    switch (type) {
      case "mention":
        return "mentioned you";
      case "reply":
        return "replied to you";
      case "like":
        return "liked your post";
      case "repost":
        return "reposted your content";
      case "zap":
        return "zapped you";
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 border-b border-border last:border-b-0 ${
        !read ? "bg-muted/30" : ""
      }`}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        {metadata?.picture && <AvatarImage src={metadata.picture} />}
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="font-medium truncate">{displayName}</span>
          <span className="text-sm text-muted-foreground">{getMessage()}</span>
        </div>
        {content && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {content}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(timestamp)}
        </p>
      </div>

      {!read && (
        <Button variant="ghost" size="sm" onClick={onMarkRead}>
          <Check className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});

export const Notifications = memo(function Notifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotifications();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll see mentions, replies, likes, and zaps here
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                id={notification.id}
                type={notification.type}
                pubkey={notification.event.pubkey}
                content={notification.event.content?.slice(0, 100)}
                timestamp={notification.timestamp}
                read={notification.read}
                onMarkRead={() => markAsRead(notification.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
