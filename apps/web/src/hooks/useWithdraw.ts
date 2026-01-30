import { useCurrentUser } from './useCurrentUser';
import { createNIP98AuthHeader } from '../lib/nip98';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function buildNip98Url(apiPath: string): string {
  return apiPath.startsWith("http")
    ? apiPath
    : `${window.location.origin}${apiPath}`;
}

export function useWithdraw() {
  const { user } = useCurrentUser();

  const withdraw = async (amount: number, lightningAddress: string) => {
    const apiPath = `${API_BASE}/wallet/withdraw`;
    const nip98Url = buildNip98Url(apiPath);
    const signer = user?.signer || (window.nostr as any);
    const authHeader = await createNIP98AuthHeader(nip98Url, "POST", signer);

    const response = await fetch(apiPath, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, lightningAddress }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Withdrawal failed");
    }

    return response.json();
  };

  return { withdraw };
}
