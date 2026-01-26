import { useState, useCallback, useEffect } from "react";
import { useNostr } from "@nostrify/react";
import type { NostrEvent, NostrFilter } from "@nostrify/nostrify";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { nip19 } from "nostr-tools";

interface DirectMessage {
  id: string;
  pubkey: string;
  content: string;
  decryptedContent?: string;
  createdAt: number;
  sent: boolean;
  encrypted: boolean;
}

interface Conversation {
  pubkey: string;
  messages: DirectMessage[];
  lastMessage?: DirectMessage;
  unreadCount: number;
}

export function useEncryptedDMs() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [conversations, setConversations] = useState<Map<string, Conversation>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [decryptionCache] = useState<Map<string, string>>(new Map());

  const isNip04Supported = user?.signer?.nip04 !== undefined;

  const decryptMessage = useCallback(
    async (event: NostrEvent): Promise<string | null> => {
      if (!isNip04Supported || !user) return null;

      const cached = decryptionCache.get(event.id);
      if (cached) return cached;

      try {
        const pTags = event.tags.filter((tag) => tag[0] === "p");
        let otherPubkey: string | undefined;

        if (event.pubkey === user.pubkey) {
          otherPubkey = pTags[0]?.[1];
        } else {
          otherPubkey = event.pubkey;
        }

        if (!otherPubkey) return null;

        const decrypted = await user.signer.nip04!.decrypt(
          otherPubkey,
          event.content
        );
        decryptionCache.set(event.id, decrypted);
        return decrypted;
      } catch (error) {
        console.error("Failed to decrypt message:", error);
        return null;
      }
    },
    [user, decryptionCache, isNip04Supported]
  );

  const processDMEvent = useCallback(
    async (event: NostrEvent) => {
      if (!user) return;

      const pTags = event.tags.filter((tag) => tag[0] === "p");
      const otherPubkey =
        event.pubkey === user.pubkey
          ? pTags.find((tag) => tag[1] !== user.pubkey)?.[1]
          : event.pubkey;

      if (!otherPubkey) return;

      const decryptedContent = await decryptMessage(event);

      const message: DirectMessage = {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        decryptedContent: decryptedContent || undefined,
        createdAt: event.created_at,
        sent: event.pubkey === user.pubkey,
        encrypted: true,
      };

      setConversations((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(otherPubkey) || {
          pubkey: otherPubkey,
          messages: [],
          unreadCount: 0,
        };

        if (existing.messages.some((m) => m.id === message.id)) {
          return prev;
        }

        existing.messages = [...existing.messages, message].sort(
          (a, b) => a.createdAt - b.createdAt
        );
        existing.lastMessage = message;

        if (!message.sent) {
          existing.unreadCount++;
        }

        newMap.set(otherPubkey, existing);
        return newMap;
      });
    },
    [user, decryptMessage]
  );

  const loadDMs = useCallback(async () => {
    if (!user || !nostr) return;

    setIsLoading(true);

    try {
      const filters: NostrFilter[] = [
        { kinds: [4], authors: [user.pubkey], limit: 100 },
        { kinds: [4], "#p": [user.pubkey], limit: 100 },
      ];

      const events = await nostr.query(filters, {
        signal: AbortSignal.timeout(5000),
      });

      for (const event of events) {
        await processDMEvent(event);
      }
    } catch (error) {
      console.error("Failed to load DMs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, nostr, processDMEvent]);

  const sendDM = useCallback(
    async (recipientPubkey: string, content: string) => {
      if (!isNip04Supported || !user) {
        return null;
      }

      try {
        let pubkey = recipientPubkey;
        if (recipientPubkey.startsWith("npub")) {
          const decoded = nip19.decode(recipientPubkey);
          if (decoded.type !== "npub") {
            throw new Error("Invalid npub");
          }
          pubkey = decoded.data;
        }

        const encrypted = await user.signer.nip04!.encrypt(pubkey, content);

        const tags: string[][] = [["p", pubkey]];

        const event = await user.signer.signEvent({
          kind: 4,
          content: encrypted,
          tags,
          created_at: Math.floor(Date.now() / 1000),
        });

        await nostr.event(event);
        await processDMEvent(event);

        return event;
      } catch (error) {
        console.error("Failed to send DM:", error);
        return null;
      }
    },
    [user, nostr, processDMEvent, isNip04Supported]
  );

  const markAsRead = useCallback((pubkey: string) => {
    setConversations((prev) => {
      const newMap = new Map(prev);
      const conversation = newMap.get(pubkey);
      if (conversation) {
        conversation.unreadCount = 0;
        newMap.set(pubkey, conversation);
      }
      return newMap;
    });
  }, []);

  const deleteConversation = useCallback((pubkey: string) => {
    setConversations((prev) => {
      const newMap = new Map(prev);
      newMap.delete(pubkey);
      return newMap;
    });
  }, []);

  useEffect(() => {
    if (!user || !nostr) return;

    const filters: NostrFilter[] = [
      {
        kinds: [4],
        "#p": [user.pubkey],
        since: Math.floor(Date.now() / 1000),
      },
    ];

    const abortController = new AbortController();

    const subscribe = async () => {
      try {
        const subscription = nostr.req(filters, {
          signal: abortController.signal,
        });

        for await (const msg of subscription) {
          if (msg[0] === "EVENT") {
            processDMEvent(msg[2]);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("DM subscription error:", error);
        }
      }
    };

    subscribe();

    return () => {
      abortController.abort();
    };
  }, [user, nostr, processDMEvent]);

  useEffect(() => {
    loadDMs();
  }, [loadDMs]);

  return {
    conversations: Array.from(conversations.values()),
    isLoading,
    sendDM,
    markAsRead,
    deleteConversation,
    refresh: loadDMs,
    totalUnread: Array.from(conversations.values()).reduce(
      (sum, c) => sum + c.unreadCount,
      0
    ),
  };
}
