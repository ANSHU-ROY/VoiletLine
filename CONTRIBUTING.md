# Contributing to VioletLink

Welcome to **VioletLink**! We are building an open-source, mobile-first orchestration system to solve last-mile transit chaos and night-safety vulnerabilities along Delhi Metro's Violet Line corridor in Faridabad.

We are proud to participate in **Hacktoberfest** and welcome first-time contributors! 💜

---

## 🚀 Quick Local Setup (Zero API Keys Required)

You do **not** need any API keys, cloud databases, or credit cards to develop locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/violetlink.git
   cd violetlink
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start local development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   - Rider App: [http://localhost:3000/rider](http://localhost:3000/rider)
   - Driver App: [http://localhost:3000/driver](http://localhost:3000/driver)
   - Admin Panel: [http://localhost:3000/admin](http://localhost:3000/admin)

5. **Validate data schemas:**
   ```bash
   npm run validate-data
   ```

6. **Run automated test suite:**
   ```bash
   npm test
   ```

---

## 🎯 10+ Curated "Good First Issue" Tasks

Looking to make your first open-source contribution? Check out these bite-sized issues tagged `good first issue` and `hacktoberfest`:

1. **Issue #101: Add Yellow Line Station — Millennium City Centre Gurugram**
   - File: `data/yellow-line/millennium-city-centre.json`
   - Add gate metadata, Fortis hospital auto stand, and Cyber City / Sector 29 drop zones.
2. **Issue #102: Add Blue Line Station — Noida Electronic City**
   - File: `data/blue-line/noida-electronic-city.json`
   - Map gates, NH-24 feeder bays, and Indirapuram drop zones.
3. **Issue #103: Translate Driver App Voice Prompts to Haryanvi dialect**
   - Add regional Haryanvi phonetic voice phrasing for rural auto drivers in Ballabhgarh.
4. **Issue #104: Add High-Contrast Dark Mode Toggle for Driver Night Driving**
   - Style adjustments in `src/driver/DriverLayout.tsx` for reduced OLED glare at night.
5. **Issue #105: SVG Map Pin Customization for E-Rickshaws vs CNG Autos**
   - Update `src/components/MapMarkers.tsx` with distinct vehicle silhouettes.
6. **Issue #106: Add Badarpur Border Interstate Bus Stand (ISBT) timetable sync**
   - Add Haryana Roadways connecting feeder schedule JSON.
7. **Issue #107: Haptic Feedback on Incoming Driver Request**
   - Use `navigator.vibrate([200, 100, 200])` when a new pod dispatch card appears.
8. **Issue #108: Audio Volume Booster for Driver Announcement in Traffic**
   - Implement Web Audio API gain node filter for noisy Mathura Road conditions.
9. **Issue #109: Add Escorts Mujesar Gate 2 Night Lighting Survey Update**
   - Add verified community photos and streetlight status to `data/violet-line/escorts-mujesar.json`.
10. **Issue #110: Hindi Translation for Hazard Report Category Labels**
    - Localize "Waterlogged Underpass" -> "जलभराव वाला अंडरपास", "Broken Streetlight" -> "खराब स्ट्रीटलाइट".
11. **Issue #111: Offline PWA Tile Cache Pre-fetching for Selected Station**
    - Pre-cache Leaflet tiles within 2km radius when a commuter boards the train.

---

## 📋 Pull Request Guidelines

1. Fork the repo and create your branch from `main`:
   ```bash
   git checkout -b feature/add-station-xyz
   ```
2. If adding station data, ensure it passes JSON schema validation:
   ```bash
   npm run validate-data
   ```
3. Ensure all automated tests pass:
   ```bash
   npm test
   ```
4. Write clear commit messages using Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).
5. Submit your PR and reference the associated issue number!
