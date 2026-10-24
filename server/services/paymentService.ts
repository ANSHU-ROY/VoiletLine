// server/services/paymentService.ts
import crypto from 'crypto';

export interface PaymentOrder {
  orderId: string;
  amountPaisa: number;
  currency: string;
  keyId: string;
  isMock: boolean;
}

export interface IPaymentGateway {
  createOrder(amountRupees: number, receiptId: string): Promise<PaymentOrder>;
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
  refund(paymentId: string, amountRupees: number): Promise<{ refundId: string; status: string }>;
}

export class MockPaymentGateway implements IPaymentGateway {
  async createOrder(amountRupees: number, receiptId: string): Promise<PaymentOrder> {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`💳 [PAYMENTS MOCK] Created order ${mockOrderId} for ₹${amountRupees} (Receipt: ${receiptId})`);
    return {
      orderId: mockOrderId,
      amountPaisa: Math.round(amountRupees * 100),
      currency: 'INR',
      keyId: 'rzp_test_mock_mode_active',
      isMock: true
    };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    console.log(`💳 [PAYMENTS MOCK] Signature verified for order ${orderId} & payment ${paymentId}`);
    return true;
  }

  async refund(paymentId: string, amountRupees: number): Promise<{ refundId: string; status: string }> {
    const refundId = `rfnd_mock_${Date.now()}`;
    console.log(`💳 [PAYMENTS MOCK] Refunded ₹${amountRupees} for payment ${paymentId} -> ${refundId}`);
    return {
      refundId,
      status: 'processed'
    };
  }
}

export class RazorpayPaymentGateway implements IPaymentGateway {
  private keyId: string;
  private keySecret: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  async createOrder(amountRupees: number, receiptId: string): Promise<PaymentOrder> {
    const amountPaisa = Math.round(amountRupees * 100);
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amountPaisa,
        currency: 'INR',
        receipt: receiptId,
        payment_capture: 1
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Razorpay createOrder failed: ${err}`);
    }

    const data = await res.json();
    return {
      orderId: data.id,
      amountPaisa: data.amount,
      currency: data.currency,
      keyId: this.keyId,
      isMock: false
    };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
  }

  async refund(paymentId: string, amountRupees: number): Promise<{ refundId: string; status: string }> {
    const amountPaisa = Math.round(amountRupees * 100);
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amountPaisa,
        reverse_all: 1
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Razorpay refund failed: ${err}`);
    }

    const data = await res.json();
    return {
      refundId: data.id,
      status: data.status
    };
  }
}

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export const paymentGateway: IPaymentGateway = (keyId && keySecret && !process.env.MOCK_PAYMENTS)
  ? new RazorpayPaymentGateway(keyId, keySecret)
  : new MockPaymentGateway();
