import { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, ArrowLeft, Lock } from "lucide-react";
import { useEncryptedDMs } from "@/hooks/useEncryptedDMs";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface ConversationItemProps {
  pubkey: string;
  lastMessage?: string;
  unreadCount: number;
  timestamp?: number;
  onClick: () => void;
}

const ConversationItem = memo(function ConversationItem({
  pubkey,
  lastMessage,
  unreadCount,
  timestamp,
  onClick,
}: ConversationItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(pubkey);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors text-left"
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        {metadata?.picture && <AvatarImage src={metadata.picture} />}
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">{displayName}</span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(timestamp)}
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-sm text-muted-foreground truncate">{lastMessage}</p>
        )}
      </div>

      {unreadCount > 0 && (
        <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
          {unreadCount}
        </span>
      )}
    </button>
  );
});

interface ChatViewProps {
  pubkey: string;
  onBack: () => void;
}

const ChatView = memo(function ChatView({ pubkey, onBack }: ChatViewProps) {
  const [message, setMessage] = useState("");
  const { conversations, sendDM, markAsRead } = useEncryptedDMs();
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(pubkey);

  const conversation = conversations.find((c) => c.pubkey === pubkey);
  const messages = conversation?.messages || [];

  const handleSend = async () => {
    if (!message.trim()) return;
    await sendDM(pubkey, message);
    setMessage("");
    markAsRead(pubkey);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-8 w-8">
          {metadata?.picture && <AvatarImage src={metadata.picture} />}
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{displayName}</span>
        <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.sent
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm">
                {msg.decryptedContent || "[Encrypted]"}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {formatRelativeTime(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
});

export const DirectMessages = memo(function DirectMessages() {
  const [selectedPubkey, setSelectedPubkey] = useState<string | null>(null);
  const { conversations, isLoading, totalUnread } = useEncryptedDMs();

  if (selectedPubkey) {
    return (
      <Card className="w-full h-96">
        <ChatView pubkey={selectedPubkey} onBack={() => setSelectedPubkey(null)} />
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Messages
            {totalUnread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                {totalUnread}
              </span>
            )}
          </CardTitle>
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Messages are end-to-end encrypted
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.pubkey}
                pubkey={conv.pubkey}
                lastMessage={conv.lastMessage?.decryptedContent}
                unreadCount={conv.unreadCount}
                timestamp={conv.lastMessage?.createdAt}
                onClick={() => setSelectedPubkey(conv.pubkey)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
