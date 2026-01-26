import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { NPool, NRelay1, type NostrEvent } from "@nostrify/nostrify";
import { NostrContext } from "@nostrify/react";
import { NostrLoginProvider } from "@nostrify/react/login";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface AuthProviderProps {
  children: ReactNode;
  relayUrls?: string[];
  storageKey?: string;
}

const defaultRelays = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 3,
    },
  },
});

const AuthContext = createContext<{ isReady: boolean }>({ isReady: false });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({
  children,
  relayUrls = defaultRelays,
  storageKey = "nostr:login",
}: AuthProviderProps) {
  const relaysRef = useRef<Set<string>>(new Set(relayUrls));
  const poolRef = useRef<NPool | undefined>(undefined);

  useEffect(() => {
    relaysRef.current = new Set(relayUrls);
  }, [relayUrls]);

  if (!poolRef.current) {
    poolRef.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        const relayMap = new Map<string, typeof filters>();
        for (const relay of relaysRef.current) {
          relayMap.set(relay, filters);
        }
        return relayMap;
      },
      eventRouter(_event: NostrEvent) {
        return [...relaysRef.current];
      },
    });
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NostrLoginProvider storageKey={storageKey}>
        <NostrContext.Provider value={{ nostr: poolRef.current }}>
          <AuthContext.Provider value={{ isReady: true }}>
            {children}
          </AuthContext.Provider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </QueryClientProvider>
  );
}
