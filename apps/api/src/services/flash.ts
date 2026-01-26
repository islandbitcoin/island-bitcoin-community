/**
 * Flash API client for Lightning Address payments
 * https://flash.satsale.io
 */

export interface FlashPaymentResult {
  success: boolean;
  paymentHash?: string;
  error?: string;
}

/**
 * Send payment via Flash API to a Lightning Address
 */
export async function sendPayment(
  lightningAddress: string,
  amount: number,
  oryToken: string
): Promise<FlashPaymentResult> {
  try {
    const response = await fetch('https://flash.satsale.io/api/payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oryToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        destination: lightningAddress, 
        amount 
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }
    
    const data = await response.json();
    return { 
      success: true, 
      paymentHash: data.paymentHash || data.payment_hash 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
