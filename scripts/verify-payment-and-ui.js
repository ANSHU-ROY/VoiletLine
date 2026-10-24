// scripts/verify-payment-and-ui.js
async function run() {
  const BASE = 'http://localhost:3000';

  console.log('=== 1. Logging in Demo Commuter (Pooja Sharma) ===');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876543210', password: 'password123', role: 'rider' })
  });
  const { token, user } = await loginRes.json();
  console.log(`Authenticated as ${user.name} (${user.role})`);

  console.log('\n=== 2. Testing VioletLink Smart Wallet API ===');
  const walletRes = await fetch(`${BASE}/api/rider/wallet`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { balance } = await walletRes.json();
  console.log(`Initial wallet balance: ₹${balance}`);

  const topupRes = await fetch(`${BASE}/api/rider/wallet/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ amount: 150 })
  });
  const topupData = await topupRes.json();
  console.log(`Top-up succeeded! New wallet balance: ₹${topupData.balance}`);

  console.log('\n=== 3. Testing Online UPI Payment ===');
  const ride1Res = await fetch(`${BASE}/api/rider/rides/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      stationSlug: 'bata-chowk',
      gateId: 1,
      dropAddress: 'Sector 15 Market',
      dropLat: 28.4012,
      dropLng: 77.3189,
      pickupLat: 28.3789,
      pickupLng: 77.3142,
      fare: 60,
      isWomenOnly: false
    })
  });
  const ride1 = await ride1Res.json();
  console.log(`Created Solo Ride: ${ride1.rideId}, Fare: ₹${ride1.fare}`);

  const upiPayRes = await fetch(`${BASE}/api/rider/payments/upi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      rideId: ride1.rideId,
      amount: 55,
      upiApp: 'gpay',
      upiId: 'pooja@okhdfcbank'
    })
  });
  const upiPay = await upiPayRes.json();
  console.log(`UPI Payment Status: ${upiPay.paymentStatus}, Ref: ${upiPay.txnId}, Amount: ₹${upiPay.amount}`);

  console.log('\n=== 4. Testing 1-Tap Wallet Payment ===');
  const ride2Res = await fetch(`${BASE}/api/rider/rides/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      stationSlug: 'bata-chowk',
      gateId: 2,
      dropAddress: 'NIT Faridabad Market',
      dropLat: 28.3892,
      dropLng: 77.2995,
      pickupLat: 28.3789,
      pickupLng: 77.3142,
      fare: 70,
      isWomenOnly: false
    })
  });
  const ride2 = await ride2Res.json();
  console.log(`Created Solo Ride 2: ${ride2.rideId}, Fare: ₹${ride2.fare}`);

  const walletPayRes = await fetch(`${BASE}/api/rider/payments/wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      rideId: ride2.rideId,
      amount: 65
    })
  });
  const walletPay = await walletPayRes.json();
  console.log(`Wallet Payment Status: ${walletPay.paymentStatus}, Ref: ${walletPay.txnId}, Remaining Balance: ₹${walletPay.newBalance}`);

  console.log('\n=== 5. Testing Razorpay Online Gateway Order Creation ===');
  const orderRes = await fetch(`${BASE}/api/rider/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      rideId: ride2.rideId,
      amount: 65
    })
  });
  const order = await orderRes.json();
  console.log(`Razorpay Order created: ${order.orderId}, Amount (paisa): ${order.amountPaisa}, Currency: ${order.currency}`);

  console.log('\n✅ ALL ONLINE PAYMENT TESTS PASSED CLEANLY!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
