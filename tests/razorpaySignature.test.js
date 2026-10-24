// tests/razorpaySignature.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { RazorpayPaymentGateway } from '../server/services/paymentService.js';

test('Razorpay HMAC SHA256 Signature Verification', () => {
  const keyId = 'rzp_test_sampleKey123';
  const keySecret = 'sampleSecretSecretKey456';
  const gateway = new RazorpayPaymentGateway(keyId, keySecret);

  const orderId = 'order_9A33XWu170gUtm';
  const paymentId = 'pay_29Ae07HxOfLQN5';

  // Compute expected HMAC SHA256 signature
  const body = `${orderId}|${paymentId}`;
  const validSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  // 1. Valid signature passes
  const isValid = gateway.verifySignature(orderId, paymentId, validSignature);
  assert.equal(isValid, true, 'Valid HMAC signature must verify successfully');

  // 2. Tampered signature fails
  const tamperedSignature = validSignature.substring(0, validSignature.length - 2) + '00';
  const isTamperedValid = gateway.verifySignature(orderId, paymentId, tamperedSignature);
  assert.equal(isTamperedValid, false, 'Tampered signature must be rejected');

  // 3. Tampered paymentId fails
  const isAlteredPaymentValid = gateway.verifySignature(orderId, 'pay_HACKED123', validSignature);
  assert.equal(isAlteredPaymentValid, false, 'Altered payment ID must be rejected');
});
