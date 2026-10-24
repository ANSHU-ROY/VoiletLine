# VioletLink — Known Limitations & Free-Tier Scaling Roadmap

This document outlines the current architectural trade-offs, MVP limitations, and how the platform scales beyond free-tier constraints as commuter volume increases.

---

## 1. MVP Scope & Architectural Limitations

### A. Driver Payouts & Marketplace Splitting (Razorpay Route)
- **Constraint:** Direct automated disbursement of rider payments into individual driver bank accounts via UPI/IMPS requires **Razorpay Route** or **Cashfree Marketplace**, both of which mandate regulatory business entity registration, GSTIN, and merchant KYC verification.
- **MVP Approach:** The platform collects payment in Razorpay Test Mode (or simulates via local mock), records the transaction with HMAC signature verification, and presents the driver with a verified "Fare Confirmed" badge while updating their daily earnings ledger. Drivers collecting cash can directly toggle "Cash Received".
- **Production Solution:** Once an NGO or registered auto cooperative entity is established, onboard drivers via Razorpay Linked Accounts and initiate automated daily batch settlements.

### B. DMRC Real-Time Telemetry Constraints
- **Constraint:** The Delhi Metro Rail Corporation (DMRC) does not currently publish a public, high-frequency real-time GTFS-RT train location stream.
- **MVP Approach:** VioletLink combines a curated static timetable of peak-hour Violet Line trains with an interactive, configurable **Simulated Train Clock Engine**.
- **Production Solution:** Crowdsourced train tracking via commuter GPS velocity filtering (similar to *Where is My Train*) when users are inside underground or elevated cars between Badarpur and Ballabhgarh.

---

## 2. Free-Tier Limits & Scaling Thresholds

| Infrastructure Layer | Free Tier Limit | Threshold Where It Breaks | Mitigation & Upgrade Path |
|---|---|---|---|
| **Neon Cloud PostgreSQL** | 0.5 GB storage, compute scales to zero after 5 min idle | Breaks at ~200,000 completed rides or persistent high-concurrency connections. | 1. Automated TTL purging: delete completed pod membership records after 24 hours.<br>2. Archive historical location telemetry after 30 days.<br>3. Upgrade to Neon Launch tier ($19/mo) or self-host PostgreSQL on Hetzner ($5/mo). |
| **OSRM Public Routing** | ~1 request / second fair use | Breaks during sudden commuter exit surges (e.g. 50 riders exiting simultaneously at Bata Chowk). | Local Haversine spatial calculation fallback is built-in; alternatively run a local OSRM Docker container with Haryana/Delhi `.pbf` map data (requires 2GB RAM). |
| **OpenStreetMap Tile CDN** | Subject to standard OSM tile usage policy | High daily map views (> 50,000 tiles/day) will trigger tile blocking. | Pre-cache station bounding boxes into local PWA Service Worker cache, or use MapLibre with free vector tiles from Protomaps/Stadia. |
| **Telegram Bot API** | 30 requests / second | Heavy concurrent dispatch across all 12 stations simultaneously. | Implement local batching queue with Exponential Backoff retry. |

---

## 3. Production Roadmap

1. **Automated Driver KYC:** Optical Character Recognition (OCR) for Indian Driving Licenses and Commercial Auto Badges via Tesseract.js / AWS Textract.
2. **Offline-First PWA Background Sync:** Enable commuters in low-connectivity underground stretches (e.g. approaching Sarai or Badarpur) to form pods offline and sync automatically upon network re-acquisition.
3. **Multi-Line Metro Expansion:** Expand data models to Yellow Line (Millennium City Centre / Huda City Centre) and Blue Line (Noida Electronic City) using community contributions.
