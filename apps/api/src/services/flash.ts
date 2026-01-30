/**
 * Flash GraphQL API client for Lightning payments
 * https://api.flashapp.me/graphql
 */

const FLASH_API = 'https://api.flashapp.me/graphql';

export interface FlashPaymentResult {
  success: boolean;
  paymentHash?: string;
  error?: string;
}

async function flashGraphQL(
  query: string,
  variables: Record<string, unknown>,
  token: string
): Promise<{ data?: any; errors?: { message: string }[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(FLASH_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDefaultWalletId(token: string): Promise<string> {
  const { data, errors } = await flashGraphQL(
    `query { me { defaultAccount { defaultWalletId } } }`,
    {},
    token
  );
  if (errors?.length) throw new Error(errors[0].message);
  const walletId = data?.me?.defaultAccount?.defaultWalletId;
  if (!walletId) throw new Error('No default wallet found');
  return walletId;
}

export async function payInvoice(
  paymentRequest: string,
  walletId: string,
  token: string,
  memo?: string
): Promise<FlashPaymentResult> {
  const { data, errors } = await flashGraphQL(
    `mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
      lnInvoicePaymentSend(input: $input) {
        status
        errors { message }
      }
    }`,
    { input: { walletId, paymentRequest, memo } },
    token
  );
  if (errors?.length) return { success: false, error: errors[0].message };
  const result = data?.lnInvoicePaymentSend;
  if (result?.status === 'SUCCESS') return { success: true, paymentHash: paymentRequest };
  const errMsg = result?.errors?.[0]?.message || `Payment failed: ${result?.status}`;
  return { success: false, error: errMsg };
}

export async function resolveLightningAddress(
  address: string,
  amountSats: number
): Promise<{ success: true; paymentRequest: string } | { success: false; error: string }> {
  try {
    const [user, domain] = address.split('@');
    if (!user || !domain) return { success: false, error: 'Invalid lightning address' };

    const controller1 = new AbortController();
    const t1 = setTimeout(() => controller1.abort(), 10_000);
    const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`, {
      signal: controller1.signal,
    });
    clearTimeout(t1);
    if (!lnurlRes.ok) return { success: false, error: `LNURL fetch failed: ${lnurlRes.status}` };

    const lnurl = await lnurlRes.json();
    if (!lnurl.callback) return { success: false, error: 'No callback in LNURL response' };

    const millisats = amountSats * 1000;
    if (lnurl.minSendable && millisats < lnurl.minSendable)
      return { success: false, error: `Amount below minimum: ${lnurl.minSendable / 1000} sats` };
    if (lnurl.maxSendable && millisats > lnurl.maxSendable)
      return { success: false, error: `Amount above maximum: ${lnurl.maxSendable / 1000} sats` };

    const sep = lnurl.callback.includes('?') ? '&' : '?';
    const controller2 = new AbortController();
    const t2 = setTimeout(() => controller2.abort(), 10_000);
    const invoiceRes = await fetch(`${lnurl.callback}${sep}amount=${millisats}`, {
      signal: controller2.signal,
    });
    clearTimeout(t2);
    if (!invoiceRes.ok) return { success: false, error: `Invoice fetch failed: ${invoiceRes.status}` };

    const invoice = await invoiceRes.json();
    if (!invoice.pr) return { success: false, error: 'No payment request in invoice response' };

    return { success: true, paymentRequest: invoice.pr };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'LNURL resolution failed' };
  }
}

export async function sendPayment(
  lightningAddress: string,
  amount: number,
  token: string
): Promise<FlashPaymentResult> {
  try {
    const resolved = await resolveLightningAddress(lightningAddress, amount);
    if (!resolved.success) return { success: false, error: resolved.error };

    const walletId = await getDefaultWalletId(token);
    return await payInvoice(resolved.paymentRequest, walletId, token, 'Island Bitcoin Community payout');
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
