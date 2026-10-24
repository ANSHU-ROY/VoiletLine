# Architecture Decision Record (ADR) - VioletLink

**Project:** VioletLink — Last-Mile Commuter & Driver Orchestration Platform  
**Target Region:** DMRC Violet Line Corridor (Faridabad: Badarpur Border to Raja Nahar Singh)  
**Status:** Approved & Implemented  
**Date:** October 2026  
**License:** MIT  

---

## 1. Context & Problem Statement

Commuters exiting Violet Line metro stations in Faridabad (from Badarpur Border to Raja Nahar Singh / Ballabhgarh) face severe last-mile inefficiencies:
1. **Coordination Chaos:** Shared autos and e-rickshaws wait for full occupancy (4–6 passengers heading to NIT, Sector 15/16, Neharpar, Manav Rachna / MRIIRS, etc.) leading to shouting, gate bottlenecks (e.g. 15 autos crowding Gate 1 while 30 riders wait stranded at Gate 2), and unpredictability.
2. **Nighttime Safety Vulnerability:** After 7:00 PM, lone commuters—particularly women and students—must choose between inflated solo charter fares (₹100–₹150) or walking through unlit corridors, dark alleys, and waterlogged underpasses.
3. **Operational Constraints:** System must run entirely on **free-tier / zero-cost infrastructure**, provide an instant **zero-API-key local mock mode** (`npm install && npm run dev`), support atomic ride dispatching without race conditions, and run smoothly on low-end Android smartphones over spotty 4G networks.

---

## 2. Evaluation of Backend & Database Options

We evaluated 5 architectural combinations across 7 core technical criteria:

| Evaluation Criteria | Option A: Supabase (PostgreSQL + PostGIS + GoTrue + Realtime) | Option B: PostgreSQL on Neon + PostGIS + Node.js/Socket.io | Option C: Turso (LibSQL) / Local SQLite + Node.js/Socket.io (Hybrid Adapter) | Option D: Firebase / Cloud Firestore | Option E: PocketBase (Embedded SQLite / Go) |
|---|---|---|---|---|---|
| **Realtime Updates** | Postgres WAL replication to WebSockets (excellent, but connection quotas on free tier) | Custom Socket.io cluster (unlimited local/self-hosted connections, sub-10ms pub/sub) | Native Socket.io engine with room multiplexing; zero cloud latency | Realtime snapshots (high read costs, 50k reads/day limit) | Built-in SSE realtime (single process, lightweight) |
| **Geospatial Queries (Nearest Driver)** | PostGIS `ST_DWithin` & `ST_Distance` (industry standard) | PostGIS `ST_DWithin` on cloud; Haversine / spatial index locally | SQL Haversine spherical bounding box queries + in-memory R-Tree spatial indexing | GeoFirestore / Geohashes (clunky range queries, client filtering) | Manual SQLite coordinate bounding box queries |
| **Atomic Operations (No Double Booking)** | Postgres Row-level lock (`SELECT FOR UPDATE SKIP LOCKED`) | Postgres Row-level lock / transactional isolation | SQLite `BEGIN IMMEDIATE` / `BEGIN EXCLUSIVE` with atomic single-row CAS update | Firestore batch transactions (`runTransaction`) | SQLite single-writer lock |
| **Role-Based Access Control (RBAC)** | Row Level Security (RLS) in database + JWT claims | Application middleware + DB relation constraints | Application-level RBAC middleware + strict schema check constraints | Firestore Security Rules | PocketBase collection API rules |
| **Free-Tier Limits & Cost** | 500 MB DB, 50k MAU, pauses after 1 week inactivity | 0.5 GB storage, computes scale to zero, no pauses | **100% Free locally (unlimited)**; Turso 9GB free / Neon Postgres free | 1 GiB storage, 50k reads/day, 20k writes/day | 100% Free self-hosted |
| **Offline / Low-Network Behavior** | Client SDK offline cache | Service Worker + local state queue | Service Worker PWA + optimistic UI updates + auto-reconnect WebSocket | Firestore offline persistence | Client SDK offline cache |
| **Zero-Key Local Contributor Setup** | High friction (requires Docker CLI or Supabase cloud account) | Medium friction (requires Docker/Postgres locally) | **Zero friction (100% turnkey SQLite in-process, zero keys, zero daemons)** | Medium friction (Firebase emulator or project credentials) | Low friction (single binary) |
| **Composite Score (out of 35)** | 29/35 | 30/35 | **34/35 (Selected)** | 24/35 | 28/35 |

---

## 3. Final Architecture Choices & Justifications

To ensure **zero developer friction**, **absolute mock-mode determinism**, and **seamless cloud-readiness**, we selected a **Hexagonal / Clean Architecture** with pluggable adapters:

```
+-------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                 |
|   +-----------------------+ +-----------------------+ +--------------------+   |
|   |   Rider PWA (/rider)  | |  Driver PWA (/driver) | | Admin PWA (/admin) |   |
|   | Calm Violet (#6366F1) | | High Contrast Yellow  | | Deep Slate Dark    |   |
|   +-----------------------+ +-----------------------+ +--------------------+   |
+-------------------------------------------------------------------------------+
                                      | HTTP REST + WebSocket (Socket.io)
+-------------------------------------------------------------------------------+
|                               APPLICATION BACKEND                             |
|  +-------------------------------------------------------------------------+  |
|  | Modules: Auth & RBAC | Pod Engine | Ride Dispatcher | Hazard Corridors  |  |
|  |          Payments (Razorpay Test) | Gate Queues | Telemetry & Simulator |  |
|  +-------------------------------------------------------------------------+  |
|                                      |                                        |
|  +-----------------------------------+-------------------------------------+  |
|  | Interface Abstraction Layer (Adapters)                                   |  |
|  | - IDatabaseAdapter   -> SQLiteAdapter (Local) / PostgresAdapter (Cloud)  |  |
|  | - ISmsService        -> ConsoleMockSms (Local) / Fast2SmsProvider (Prod) |  |
|  | - IPaymentGateway    -> MockRazorpay (Local) / RazorpayTestMode (Prod)   |  |
|  | - IMapRoutingService -> LocalHaversine / OSRM Public Demo Server        |  |
|  | - ITtsNotifier       -> BrowserSpeechSynthesis + Telegram Bot Dispatch   |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

### 1. Database & Persistence Layer: SQLite (Local) with PostgreSQL/PostGIS Adapter
- **Decision:** SQLite via `better-sqlite3` / `sql.js` for local development, with an abstract `IDatabaseAdapter` that mirrors PostgreSQL queries.
- **Justification:** Zero installation overhead. Contributors run `npm install && npm run dev` without starting Docker, downloading Postgres, or signing up for cloud databases. Atomic transactions are natively supported with `BEGIN IMMEDIATE`. When deploying to Neon or Supabase, setting `DATABASE_URL` activates the PostgreSQL driver.

### 2. Realtime Telemetry & State Synchronization: Socket.io
- **Decision:** Socket.io over WebSockets with localized rooms:
  - `rider:<rider_id>`
  - `driver:<driver_id>`
  - `pod:<pod_id>`
  - `station:<station_id>:gate:<gate_number>`
- **Justification:** Supabase Realtime has connection limits on the free tier and Firebase charges per document read. Socket.io runs in-process with zero extra infrastructure, supports reconnection fallbacks, heartbeats, and allows 5-second driver telemetry throttling.

### 3. Frontend Framework: React 18 + Vite + Tailwind CSS + Lucide Icons + Leaflet
- **Decision:** Vite Single Page Application with three isolated sub-apps (`/rider`, `/driver`, `/admin`), mobile-first responsive viewport, and Service Worker PWA manifest.
- **Justification:** Instant HMR, minimal bundle size (< 180 KB initial gzipped), touch-friendly UI components. Leaflet with OpenStreetMap tiles requires **0 API keys, 0 credit cards**, and loads cartography reliably on Indian 4G networks.

### 4. Authentication & Security: JWT + Argon2/bcrypt + Role-Based Middleware
- **Decision:** Stateless HTTP-only JWTs with embedded role claims (`RIDER`, `DRIVER`, `ADMIN`), validated in express middleware and socket handshakes.
- **Justification:** Completely self-contained. Drivers cannot access rider endpoints; riders cannot query driver dispatch queues; unapproved drivers are blocked at the database query level.

### 5. Routing & Geo-Calculations: OSRM (Open Source Routing Machine) + Local Haversine
- **Decision:** Free public OSRM car/foot profiles for polyline routes; localized spherical Haversine formula for radius dispatch and nearest driver lookups.
- **Justification:** Google Maps Distance Matrix requires credit cards and billing setups. OSRM is free and OpenStreetMap-native. If the network is offline or OSRM times out, the local Haversine fallback estimates ETA and distance immediately.

### 6. Payments: Razorpay Test Mode (Isolated Module)
- **Decision:** Razorpay Test Mode (Standard Checkout) with server-side HMAC-SHA256 signature verification (`order_id|payment_id`).
- **Justification:** Free, requires no KYC or credit card for test mode, and is the ubiquitous standard in India for UPI/QR/Netbanking. Full mock fallback allows instant test rides even without a Razorpay key.

### 7. Voice Announcements & Fallback Dispatch: Web Speech API + Telegram Bot
- **Decision:** HTML5 `window.speechSynthesis` for native Hindi voice announcements ("नया राइड अनुरोध! बाटा चौक गेट 2") on driver phones + Telegram Bot webhook script for auto drivers without smartphones.
- **Justification:** Zero API fees, zero latency, works completely offline on any Android Chrome/Firefox browser. Telegram Bot API is 100% free with no credit card and no per-message fees unlike Twilio or WhatsApp Business.

---

## 4. Free-Tier Limits & Overflow Behavior

| Service / Layer | Free Tier Limit | Behavior When Limit Exceeded | Fallback & Mitigation Strategy |
|---|---|---|---|
| **Neon PostgreSQL** | 0.5 GB storage, 1 compute branch | Queries fail on disk full; compute scales down after 5 min idle | System automatically runs on in-memory / local SQLite if `DATABASE_URL` is omitted. Pod data auto-purges after 24 hours. |
| **OSRM Public Routing** | ~1 request / second fair use | HTTP 429 Too Many Requests | Instant fallback to embedded Haversine calculation + direct line polyline. |
| **Razorpay Test Mode** | Unlimited test transactions | No hard cap on test orders | Local mock payment mode toggles instantly if `RAZORPAY_KEY_ID` is empty. |
| **Telegram Bot API** | 30 messages / second | HTTP 429 rate limit | Queue throttler with in-memory retry backoff. |
| **OpenStreetMap Tile CDN** | Subject to OSM tile usage policy | Temporary HTTP 429 tile blocking | Leaflet tile caching in browser cache + CartoDB free fallback tile server. |

---

## 5. Provider Interchangeability (Clean Interfaces)

All external integrations adhere to strict TypeScript interfaces:

1. `IDatabaseAdapter`:
   ```ts
   interface IDatabaseAdapter {
     query<T>(sql: string, params?: any[]): Promise<T[]>;
     execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
     transaction<T>(fn: (tx: IDatabaseAdapter) => Promise<T>): Promise<T>;
   }
   ```
2. `ISmsService`:
   ```ts
   interface ISmsService {
     sendOtp(phoneNumber: string, otp: string): Promise<boolean>;
   }
   ```
3. `IPaymentGateway`:
   ```ts
   interface IPaymentGateway {
     createOrder(amountPaisa: number, receipt: string): Promise<{ orderId: string; amount: number; currency: string }>;
     verifySignature(orderId: string, paymentId: string, signature: string): boolean;
     refund(paymentId: string, amountPaisa: number): Promise<{ refundId: string; status: string }>;
   }
   ```
4. `IRoutingService`:
   ```ts
   interface IRoutingService {
     getRoute(origin: LatLng, destination: LatLng): Promise<{ distanceKm: number; durationMinutes: number; polyline: [number, number][] }>;
   }
   ```
