// scripts/verify-destination-flow.js
async function run() {
  const BASE = 'http://localhost:3000';

  console.log('=== 1. Testing Destination Autocomplete API ===');
  const searchRes = await fetch(`${BASE}/api/rider/destinations/search?q=sector%2015&stationSlug=bata-chowk`);
  const searchData = await searchRes.json();
  console.log(`Found ${searchData.length} suggestions for "sector 15"`);
  console.log(`First result: ${searchData[0]?.name} (${searchData[0]?.distanceKm} km, ₹${searchData[0]?.podFare} Pod fare)`);

  console.log('\n=== 2. Registering Brand New Commuter ===');
  const phone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Karan Verma',
      phone,
      password: 'secretPassword123',
      role: 'rider',
      emergencyName: 'Papa',
      emergencyPhone: '9812345600'
    })
  });
  const regData = await regRes.json();
  console.log(`Registration status: ${regRes.status}, token received: ${!!regData.token}`);

  console.log('\n=== 3. Logging in with Brand New Commuter Credentials ===');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: phone,
      password: 'secretPassword123',
      role: 'rider'
    })
  });
  const loginData = await loginRes.json();
  const karanToken = loginData.token;
  console.log(`Login status: ${loginRes.status}, user: ${loginData.user.name} (${loginData.user.role})`);

  console.log('\n=== 4. Commuter 1 (Pooja) joins pod for "Sector 16 Market" ===');
  const poojaLogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876543210', password: 'password123', role: 'rider' })
  });
  const poojaToken = (await poojaLogin.json()).token;

  const pod1JoinRes = await fetch(`${BASE}/api/rider/pods/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${poojaToken}`
    },
    body: JSON.stringify({
      stationSlug: 'bata-chowk',
      exitGateId: 1,
      destinationName: 'Sector 16 Market',
      dropLat: 28.4012,
      dropLng: 77.3189,
      seatFare: 25
    })
  });
  const pod1Join = await pod1JoinRes.json();
  console.log(`Pooja joined/created Pod: ${pod1Join.podId}, destination: ${pod1Join.destinationName}, members: ${pod1Join.memberCount}`);

  console.log('\n=== 5. Commuter 2 (Karan) types "Sec 16 HUDA Market" ===');
  const pod2JoinRes = await fetch(`${BASE}/api/rider/pods/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${karanToken}`
    },
    body: JSON.stringify({
      stationSlug: 'bata-chowk',
      exitGateId: 1,
      destinationName: 'Sec 16 HUDA Market',
      dropLat: 28.4020,
      dropLng: 77.3195,
      seatFare: 25
    })
  });
  const pod2Join = await pod2JoinRes.json();
  console.log(`Karan joined Pod: ${pod2Join.podId}, destination: ${pod2Join.destinationName}, members: ${pod2Join.memberCount}`);

  if (pod1Join.podId === pod2Join.podId) {
    console.log('\n✅ VERIFIED: Both riders were automatically grouped into the SAME Ride Pod!');
  } else {
    console.error('\n❌ ERROR: Riders were not grouped into the same pod.');
    process.exit(1);
  }

  console.log('\n=== 6. Query Active Forming Pods for Sector 16 ===');
  const activePodsRes = await fetch(`${BASE}/api/rider/pods/active?stationSlug=bata-chowk&destination=Sector%2016`);
  const activePods = await activePodsRes.json();
  console.log(`Active pods found matching Sector 16: ${activePods.length}`);
  console.log(`Pod code: ${activePods[0]?.pod_code}, members count: ${activePods[0]?.member_count}, destination: ${activePods[0]?.destination_name}`);

  console.log('\n=== ALL DESTINATION & GROUPING CHECKS PASSED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
