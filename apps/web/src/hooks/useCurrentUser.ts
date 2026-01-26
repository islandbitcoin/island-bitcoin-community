import type { NLoginType } from "@nostrify/react/login";
import { NUser, useNostrLogin } from "@nostrify/react/login";
import { useNostr } from "@nostrify/react";
import { useCallback, useMemo } from "react";

import { useAuthor } from "./useAuthor";

export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();

  const loginToUser = useCallback(
    (login: NLoginType): NUser => {
      switch (login.type) {
        case "nsec":
          return NUser.fromNsecLogin(login);
        case "bunker":
          return NUser.fromBunkerLogin(login, nostr);
        case "extension":
          return NUser.fromExtensionLogin(login);
        default:
          throw new Error(`Unsupported login type: ${login.type}`);
      }
    },
    [nostr]
  );

  const users = useMemo(() => {
    const users: NUser[] = [];

    for (const login of logins) {
      try {
        const user = loginToUser(login);
        users.push(user);
      } catch {
        // Skip invalid logins
      }
    }

    return users;
  }, [logins, loginToUser]);

  const user = users[0] as NUser | undefined;
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    ...author.data,
  };
}
