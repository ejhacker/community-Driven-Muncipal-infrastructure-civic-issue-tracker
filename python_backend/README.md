# NagrikPulse - Complete Python Full-Stack & Live GPS Telemetry Engine

Production-grade municipal civic infrastructure and defect tracker engine built with **Python 3.10**, featuring **continuous high-precision Live GPS tracking**, **PostGIS geodesic duplicate matching**, **real-time speedometers**, **compass heading telemetry**, and an **embedded standalone web dashboard**.

---

## 🚀 Key Features

1. **Live GPS Continuous Telemetry (`watchPosition` bridge):**
   - High-precision location streaming with accuracy meter (`±3.2m`)
   - Real-time walking/driving speedometer (`km/h`)
   - Compass bearing heading tracking (`0°–360°`)
   - Distance walked / surveyed counter (`meters`)
   - Real-time breadcrumb trail history polyline on the map
2. **Geodesic Spatial Primitives (PostGIS equivalent):**
   - Haversine distance calculations
   - Radial duplicate detection (warns within 65m before duplicate submission)
   - Proximity hazard alerts (triggers warning when citizen or field inspector is within 40m of an open hazard)
3. **Full Civic Issue Lifecycle:**
   - Issues ledger with ticket IDs (`NP-2026-XXXX`)
   - Priority score algorithm: $f(\text{severity}, \text{upvotes}, \text{location sensitivity}, \text{age})$
   - Department assignment & dynamic SLA countdown timers (12h / 24h / 48h / 72h)
   - Official comments & citizen confirmation ("Affected too")
   - Before & after photographic resolution evidence
   - Citizen resolution rating (1–5 stars) with reopen workflow
4. **Standalone Embedded Web Dashboard:**
   - Served directly by the Python HTTP engine on port `5050`
   - Zero external frontend dependencies required

---

## 💻 Running the Python App Standalone on PC

```bash
# 1. Run the pure Python application directly (uses Python standard library, zero pip installs needed):
python3 python_backend/app.py

# 2. Open your browser:
http://localhost:5050
```

### Running Automated Verification Tests:
```bash
python3 python_backend/app.py --test
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` or `/dashboard` | Standalone interactive HTML5/Tailwind dashboard with live GPS |
| `GET` | `/api/health` | Server status, active field trackers, and system capabilities |
| `GET` | `/api/issues` | Filtered civic issues ledger (by category, status, ward, search) |
| `POST` | `/api/issues` | Create new issue with geocoding, SLA, and priority score |
| `POST` | `/api/issues/<id>/upvote` | Citizen upvote or "I am affected too" confirmation |
| `POST` | `/api/issues/check-duplicates` | PostGIS radial duplicate verification within radius |
| `GET` | `/api/geo/reverse-geocode` | Geodesic lookup from GPS coords to municipal ward & street |
| `POST` | `/api/gps/update-telemetry` | Stream live GPS coords, speed, heading, and hazard proximity alert |
| `GET` | `/api/gps/live-tracking` | Real-time tracking data of active field force and inspectors |
| `GET` | `/api/gps/proximity-alerts` | Spatial query for open defects within given radius |
| `GET` | `/api/stats` | Municipal resolution rate, ward breakdown, and karma leaderboard |
