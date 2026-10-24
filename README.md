# 🟣 VoiletLine / VioletLink — DMRC Violet Line Last-Mile Commuter Platform

Demand-first shared auto and e-rickshaw booking for DMRC Violet Line stations in Faridabad, with ride pre-pooling, live ride coordination, and a crowdsourced Safe-Walk map.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2026-violet.svg)](https://hacktoberfest.com/)
[![Zero-Key Mock Mode](https://img.shields.io/badge/API%20Keys-Zero%20Required-success.svg)](KEYS_NEEDED.md)

**VioletLink** is an open-source, mobile-first orchestration platform solving the last-mile chaos and nighttime safety vulnerabilities at all **12 Delhi Metro (DMRC) Violet Line stations in Faridabad**:

> *Badarpur Border, Sarai, NHPC Chowk, Mewla Maharajpur, Sector 28, Badkal Mor, Old Faridabad, Neelam Chowk Ajronda, Bata Chowk, Escorts Mujesar, Sant Surdas, Raja Nahar Singh.*

Between 5:30 PM and 9:30 PM, thousands of commuters exit Faridabad metro stations to find shouting crowds, 15 rickshaws jamming Gate 1 while 30 people wait stranded at Gate 2, and dark, unlit underpasses. VioletLink replaces the shouting with **In-Train Pre-Pooling (Ride Pods)**, **Atomic Ride-Hailing**, **Gate Queues**, and a **Safe-Walk Citizen Hazard Map**.

---

## ⚡ 10-Minute Zero-Key Quickstart

VioletLink runs locally with **ZERO external API keys, ZERO cloud databases, and ZERO credit cards**. Everything works out of the box using embedded local fallbacks!

### 1. Clone & Install
```bash
git clone https://github.com/ANSHU-ROY/VoiletLine.git
cd VoiletLine
npm install
```

### 2. Start Platform
```bash
npm run dev
```

### 3. Open in Browser
Open two browser windows (e.g. normal window + incognito window) to test rider and driver interaction in real time:

- 👤 **Rider App:** [http://localhost:3000/rider](http://localhost:3000/rider)
- 🛺 **Driver App:** [http://localhost:3000/driver](http://localhost:3000/driver)
- 🛡️ **Admin Panel:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔑 Pre-Seeded Test Credentials

Every app includes **1-click instant demo login buttons**, or you can log in with these credentials (password for all is `password123`):

| Role | Mobile / Phone | User Name | Notes |
|---|---|---|---|
| **Rider (Commuter)** | `9876543210` | Pooja Sharma | Daily commuter from Bata Chowk to NIT Faridabad. |
| **Driver (Approved)** | `9811122201` | Ramesh Kumar | Auto DL1R-7788 at Bata Chowk Gate 1 (Online & Active). |
| **Driver (Pending)** | `9811122205` | Dharmendra Pal | E-Rickshaw at Sector 28 Gate 2 (Pending admin approval). |
| **Central Admin** | `9999900001` | Faridabad Admin | Central operations manager for driver approvals & safety moderation. |

*Demo OTP for all phone verification screens is `1234`.*

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology Choice | Why Selected |
|---|---|---|
| **Backend** | Node.js + Express (TypeScript) | Lightweight, single-command startup, native ESM. |
| **Database** | SQLite (`better-sqlite3` / `sql.js`) + Neon Adapter | Real ACID transactions with zero cloud friction; pluggable to PostgreSQL. |
| **Realtime** | Socket.io WebSockets | Sub-10ms pub/sub telemetry, driver room multiplexing, reconnect support. |
| **Frontend** | React 18 + Vite + Tailwind CSS + Lucide | Instant HMR, responsive mobile viewports, high contrast UI. |
| **Maps & Routing** | Leaflet + OpenStreetMap + OSRM | **100% Free, zero API keys, no credit card required**. |
| **Payments** | Razorpay Test Mode + Mock Gateway | Free test transactions with server-side HMAC-SHA256 signature verification. |
| **Voice TTS** | Browser Web Speech API + Telegram Bot | Native Hindi voice prompts on driver devices with zero latency. |

---

## 🌟 Core Features

### 🚄 Feature A: Ride Pods (In-Train Pre-Pooling)
- Riders group by **same exit station + same drop micro-zone + arrival window**.
- High-contrast visual identity: **Color + Number + Shape** (e.g. *Emerald Pod #14 — Hexagon*), ensuring accessibility for color-blind commuters.
- Privacy-first: **No phone numbers shared** between co-passengers; only first names and pod badges.
- Pod locks 3 minutes prior to arrival and is pushed to drivers near that gate.

### 🚖 Feature B: Atomic Ride-Hailing
- First accept wins via **atomic Compare-And-Swap (CAS)** operations to eliminate double-booking race conditions.
- Trips start only after the driver enters the rider's **4-digit start OTP**.
- 1-minute free cancellation window, followed by a simulated late cancellation fee.
- **Fair Gate Queue**: Autos and e-rickshaws check in to specific gates, balancing vehicle distribution between Gate 1 and Gate 2.

### 🛡️ Feature C: Safe-Walk Citizen Hazard Map
- Interactive Leaflet map marking station gates, auto stands, and active hazards:
  - 💡 *Broken Streetlights*
  - 🌊 *Waterlogged Underpasses*
  - 🌑 *Isolated Dark Stretches*
  - 🚨 *Harassment / Stray Dog Alerts*
- **30-Meter Duplicate Merging**: Reports within 30m of an existing hazard automatically upvote and extend the report rather than cluttering the map.
- Corridor safety evaluation with **Green / Amber / Red** safety scores.

### 🔊 Fallback Voice Dispatch Automation
For drivers without smartphones or active web sessions, the platform synthesizes Hindi MP3 voice notes:
> *"नमस्ते ड्राइवर भाई! बाटा चौक गेट 1 से NIT फरीदाबाद के लिए नया राइड पॉड तैयार है। कुल किराया ₹100। स्वीकार करने के लिए 1 भेजें।"*
Audio is saved to `uploads/dispatch-audio/` and optionally pushed to Telegram.

---

## 🧪 Automated Test Suite

VioletLink includes comprehensive tests covering critical race conditions and domain rules:
```bash
npm test
```

### Test Coverage:
1. `tests/podMatching.test.js`: Capacity limits, destination grouping, women-only pod isolation, color/shape identity.
2. `tests/rideStateMachine.test.js`: Complete requested &rarr; searching &rarr; accepted &rarr; arrived &rarr; in_progress &rarr; completed lifecycle.
3. `tests/nearestDriver.test.js`: Distance sorting, radius expansion (2km to 4km), unapproved/offline driver exclusion.
4. `tests/atomicAcceptance.test.js`: Concurrent race condition test where 2 drivers accept the same ride simultaneously; exactly 1 succeeds.
5. `tests/roleBasedAccess.test.js`: Middleware role enforcement (riders blocked from driver/admin APIs; unapproved drivers blocked from going online).
6. `tests/razorpaySignature.test.js`: Server-side HMAC SHA256 signature verification and tampering prevention.

### Validate Open-Source Station Datasets:
```bash
npm run validate-data
```

---

## 🤝 Hacktoberfest & Open-Source Contributing

We welcome community contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Check out our curated beginner-friendly issues in `CONTRIBUTING.md`:
- Add Yellow Line stations (e.g. Millennium City Centre Gurugram)
- Add Blue Line stations (e.g. Noida Electronic City)
- Translate Driver voice phrases to Haryanvi dialect
- Map lighting surveys along Faridabad bypass roads

---

## 📄 Documentation Links

- [Architecture Decisions Record (docs/ARCHITECTURE_DECISIONS.md)](docs/ARCHITECTURE_DECISIONS.md)
- [API Keys Checklist (KEYS_NEEDED.md)](KEYS_NEEDED.md)
- [API & Route Documentation (docs/API_DOCUMENTATION.md)](docs/API_DOCUMENTATION.md)
- [Dispatch Automation Guide (docs/DISPATCH_AUTOMATION.md)](docs/DISPATCH_AUTOMATION.md)
- [Known Limitations & Scaling Roadmap (docs/LIMITATIONS_AND_ROADMAP.md)](docs/LIMITATIONS_AND_ROADMAP.md)

---

## 📜 License

Released under the [MIT License](LICENSE). Built for the daily commuters and auto drivers of Faridabad. 💜
