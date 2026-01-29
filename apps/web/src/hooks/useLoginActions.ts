import { useNostr } from "@nostrify/react";
import { NLogin, useNostrLogin } from "@nostrify/react/login";

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec.trim());
      addLogin(login);
    },

    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
    },

    async extension(): Promise<void> {
      const login = await NLogin.fromExtension();
      addLogin(login);
    },

    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        removeLogin(login.id);
      }
    },
  };
}
