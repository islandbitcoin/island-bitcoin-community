import { useState, useEffect, useCallback } from "react";
import { useNostr } from "@nostrify/react";
import type { NostrEvent, NostrFilter } from "@nostrify/nostrify";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type NotificationType = "mention" | "reply" | "like" | "repost" | "zap";

interface Notification {
  id: string;
  type: NotificationType;
  event: NostrEvent;
  read: boolean;
  timestamp: number;
}

export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const processEvent = useCallback(
    (event: NostrEvent) => {
      if (!user) return;

      let type: NotificationType | null = null;

      if (event.kind === 1) {
        const pTags = event.tags.filter((tag) => tag[0] === "p");
        if (pTags.some((tag) => tag[1] === user.pubkey)) {
          type = "mention";
        }

        const eTags = event.tags.filter((tag) => tag[0] === "e");
        if (eTags.length > 0 && !type) {
          type = "reply";
        }
      } else if (event.kind === 7) {
        type = "like";
      } else if ([6, 16].includes(event.kind)) {
        type = "repost";
      } else if (event.kind === 9735) {
        type = "zap";
      }

      if (type) {
        const notification: Notification = {
          id: event.id,
          type,
          event,
          read: false,
          timestamp: event.created_at * 1000,
        };

        setNotifications((prev) => {
          if (prev.some((n) => n.id === notification.id)) return prev;
          return [notification, ...prev].slice(0, 100);
        });
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user || !nostr || isListening) return;

    const filters: NostrFilter[] = [
      {
        kinds: [1],
        "#p": [user.pubkey],
        since: Math.floor(Date.now() / 1000),
      },
      {
        kinds: [7],
        "#p": [user.pubkey],
        since: Math.floor(Date.now() / 1000),
      },
      {
        kinds: [6, 16],
        "#p": [user.pubkey],
        since: Math.floor(Date.now() / 1000),
      },
      {
        kinds: [9735],
        "#p": [user.pubkey],
        since: Math.floor(Date.now() / 1000),
      },
    ];

    const abortController = new AbortController();

    const startListening = async () => {
      setIsListening(true);

      try {
        const subscription = nostr.req(filters, {
          signal: abortController.signal,
        });

        for await (const msg of subscription) {
          if (msg[0] === "EVENT") {
            processEvent(msg[2]);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Error listening for notifications:", error);
        }
      } finally {
        setIsListening(false);
      }
    };

    startListening();

    return () => {
      abortController.abort();
    };
  }, [user, nostr, isListening, processEvent]);

  useEffect(() => {
    const count = notifications.filter((n) => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    isListening,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
