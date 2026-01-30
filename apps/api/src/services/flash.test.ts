import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  resolveLightningAddress,
  sendPayment,
  getDefaultWalletId,
  payInvoice,
} from './flash';

describe('Flash Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveLightningAddress', () => {
    it('should resolve a valid lightning address and return payment request', async () => {
      // First fetch: LNURL well-known
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/lnurlp/callback',
          minSendable: 1000,
          maxSendable: 1000000000,
        }),
      });
      // Second fetch: invoice from callback
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          pr: 'lnbc500n1abc123...',
        }),
      });

      const result = await resolveLightningAddress('user@example.com', 500);

      expect(result).toEqual({ success: true, paymentRequest: 'lnbc500n1abc123...' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe('https://example.com/.well-known/lnurlp/user');
      expect(mockFetch.mock.calls[1][0]).toBe('https://example.com/lnurlp/callback?amount=500000');
    });

    it('should return error for invalid address format', async () => {
      const result = await resolveLightningAddress('invalid', 100);
      expect(result).toEqual({ success: false, error: 'Invalid lightning address' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return error when LNURL fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await resolveLightningAddress('user@example.com', 100);
      expect(result).toEqual({ success: false, error: 'LNURL fetch failed: 404' });
    });

    it('should return error when callback is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ minSendable: 1000 }),
      });

      const result = await resolveLightningAddress('user@example.com', 100);
      expect(result).toEqual({ success: false, error: 'No callback in LNURL response' });
    });

    it('should return error when amount is below minimum', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb',
          minSendable: 10000, // 10 sats minimum
          maxSendable: 1000000000,
        }),
      });

      const result = await resolveLightningAddress('user@example.com', 5);
      expect(result).toEqual({ success: false, error: 'Amount below minimum: 10 sats' });
    });

    it('should return error when amount is above maximum', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb',
          minSendable: 1000,
          maxSendable: 100000, // 100 sats max
        }),
      });

      const result = await resolveLightningAddress('user@example.com', 200);
      expect(result).toEqual({ success: false, error: 'Amount above maximum: 100 sats' });
    });

    it('should return error when invoice response has no pr', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb',
          minSendable: 1000,
          maxSendable: 1000000000,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await resolveLightningAddress('user@example.com', 100);
      expect(result).toEqual({ success: false, error: 'No payment request in invoice response' });
    });

    it('should return error when invoice fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb',
          minSendable: 1000,
          maxSendable: 1000000000,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await resolveLightningAddress('user@example.com', 100);
      expect(result).toEqual({ success: false, error: 'Invoice fetch failed: 500' });
    });

    it('should handle callback URL with existing query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb?key=val',
          minSendable: 1000,
          maxSendable: 1000000000,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pr: 'lnbc123...' }),
      });

      const result = await resolveLightningAddress('user@example.com', 100);
      expect(result).toEqual({ success: true, paymentRequest: 'lnbc123...' });
      expect(mockFetch.mock.calls[1][0]).toBe('https://example.com/cb?key=val&amount=100000');
    });

    it('should handle fetch throwing (timeout/network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      const result = await resolveLightningAddress('user@example.com', 100);
      expect(result).toEqual({ success: false, error: 'The operation was aborted' });
    });
  });

  describe('getDefaultWalletId', () => {
    it('should return wallet ID on success', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { me: { defaultAccount: { defaultWalletId: 'wallet-abc' } } },
        }),
      });

      const walletId = await getDefaultWalletId('test-token');
      expect(walletId).toBe('wallet-abc');
    });

    it('should throw on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          errors: [{ message: 'Unauthorized' }],
        }),
      });

      await expect(getDefaultWalletId('bad-token')).rejects.toThrow('Unauthorized');
    });

    it('should throw when no wallet found', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { me: { defaultAccount: { defaultWalletId: null } } },
        }),
      });

      await expect(getDefaultWalletId('test-token')).rejects.toThrow('No default wallet found');
    });
  });

  describe('payInvoice', () => {
    it('should return success on successful payment', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: {
            lnInvoicePaymentSend: { status: 'SUCCESS', errors: [] },
          },
        }),
      });

      const result = await payInvoice('lnbc123...', 'wallet-abc', 'token', 'memo');
      expect(result).toEqual({ success: true, paymentHash: 'lnbc123...' });
    });

    it('should return failure on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          errors: [{ message: 'Internal error' }],
        }),
      });

      const result = await payInvoice('lnbc123...', 'wallet-abc', 'token');
      expect(result).toEqual({ success: false, error: 'Internal error' });
    });

    it('should return failure on non-SUCCESS status', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: {
            lnInvoicePaymentSend: {
              status: 'FAILURE',
              errors: [{ message: 'Route not found' }],
            },
          },
        }),
      });

      const result = await payInvoice('lnbc123...', 'wallet-abc', 'token');
      expect(result).toEqual({ success: false, error: 'Route not found' });
    });
  });

  describe('sendPayment', () => {
    it('should orchestrate full payment flow', async () => {
      // resolveLightningAddress: LNURL fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb',
          minSendable: 1000,
          maxSendable: 1000000000,
        }),
      });
      // resolveLightningAddress: invoice fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pr: 'lnbc500...' }),
      });
      // getDefaultWalletId
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { me: { defaultAccount: { defaultWalletId: 'wallet-1' } } },
        }),
      });
      // payInvoice
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: { lnInvoicePaymentSend: { status: 'SUCCESS', errors: [] } },
        }),
      });

      const result = await sendPayment('user@example.com', 500, 'token');
      expect(result).toEqual({ success: true, paymentHash: 'lnbc500...' });
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should return error if lightning address resolution fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await sendPayment('user@example.com', 500, 'token');
      expect(result).toEqual({ success: false, error: 'LNURL fetch failed: 404' });
    });

    it('should return error if getDefaultWalletId throws', async () => {
      // resolve succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          callback: 'https://example.com/cb',
          minSendable: 1000,
          maxSendable: 1000000000,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pr: 'lnbc...' }),
      });
      // getDefaultWalletId fails
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ errors: [{ message: 'Token expired' }] }),
      });

      const result = await sendPayment('user@example.com', 500, 'bad-token');
      expect(result).toEqual({ success: false, error: 'Token expired' });
    });
  });
});
