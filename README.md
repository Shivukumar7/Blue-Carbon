<div align="center">

# Blue Carbon Registry

**A coastal restoration registry, a daily stewardship ledger, and an open carbon credit marketplace — in one system.**

Coastal communities register unused tidal land. A government officer surveys it on the ground and
approves it. The area is split into one parcel per household. Every household logs a dated photo and
instrument readings each day. That evidence becomes verified blue carbon, sold openly, with the
proceeds returning to the people who did the planting.

[![License: MIT](https://img.shields.io/badge/License-MIT-0E9F6E.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A520-062229)
![React](https://img.shields.io/badge/react-18-0891B2)
![PostgreSQL](https://img.shields.io/badge/postgres-%E2%89%A514-336791)
![Maps](https://img.shields.io/badge/maps-Leaflet%20%C2%B7%20no%20API%20key-34D399)

</div>

---

## Why this exists

Mangroves, salt marsh and seagrass meadows bury carbon in waterlogged, oxygen-poor sediment where it
stays for centuries — several times faster per hectare than tropical rainforest. India has thousands
of hectares of degraded tidal flat sitting unused beside villages that need income.

The two problems solve each other, but only if three things are true at once:

| Requirement | How this system answers it |
|---|---|
| The land is genuinely unused and the community is its legitimate steward | An officer visits the site in person and traces the surveyed boundary before anything is registered |
| The restoration work actually happened | Every household files a dated photo plus three instrument readings, every day, on their own mapped parcel |
| The money reaches the people who did the work | Payouts follow a per-person credit ledger, not land title — and the ledger is visible to every member from day one |

Nothing enters this registry that an officer has not stood on, and nothing is sold that the
community's own daily reporting does not support.

---

## The lifecycle

```
  LEADER                    OFFICER                  MEMBERS                 BUYER
    |- creates community       |                        |                      |
    |- searches usernames -------------------------->  invitation              |
    |                          |                        |- accepts             |
    |- traces area on map      |                        |                      |
    |- submits application --> reviews                  |                      |
    |                          |- schedules site visit  |                      |
    |                          |- VISITS IN REAL LIFE   |                      |
    |                          |- hands over saplings + meters                 |
    |                          |- traces surveyed boundary                     |
    |                          |- approves ---------->  parcel assigned        |
    |                                                   |- plants, waters      |
    |                                                   |- photo + readings    |
    |  sees who reported <------------------------------|  -> +1 credit / day  |
    |- chases the gaps, earns 2 x participation         |                      |
    |            ... two years ...                      |                      |
    |                          |- lists verified tonnes ------------------> browses
    |                          |                                             |- buys, no account
    |                          |                                             |- gets certificate
    |- proceeds split across every credit earned <-----------------------------|
```

---

## Features by role

### Public programme page (`/`)

Hero with a **live map of every registered boundary** pulled from the registry itself, live impact
counters, a six-step explainer, a verification section showing the chain of evidence and the exact
formula behind a buyer's tonnes, a marketplace where each lot carries its own satellite map, and an
account-free checkout ending in a downloadable PDF certificate.

### Community member (`/member`)

| Feature | Detail |
|---|---|
| Invitation inbox | Accept or decline join requests; a member can belong to only one community |
| Own parcel on a map | Satellite view of just their parcel inside the dashed project boundary, with centre coordinates to find it on the ground |
| Daily entry form | Camera capture or drag-and-drop photo, plus temperature, humidity and soil moisture (required); soil pH, salinity and saplings planted (optional) |
| Guard rails | One entry per parcel per day, ranges validated, missed days cannot be back-filled |
| Credits and streak | Total credits, days reported, consecutive-day streak, two-year term progress |
| History | Last 30 entries with thumbnails, readings and notes |

### Community leader (`/leader`)

| Feature | Detail |
|---|---|
| Member search | Find registered members by username or name, see who is already taken, send join requests (25-member cap) |
| Application | Trace the coastal area on satellite imagery with a live hectare readout, choose the ecosystem, add notes for the officer |
| Project map | Every parcel coloured by whether it reported for the selected day; click any parcel for its photo, readings and history |
| Day navigator | Step through any date; the whole dashboard follows |
| Chase list | Exactly who has not reported today, when they last did, and a tap-to-call number |
| Ledger | 30-day participation chart, their own daily credits, and a per-member leaderboard |

### Government officer (`/admin`)

| Feature | Detail |
|---|---|
| Overview | Pending applications, live projects, people enrolled, credits issued, 14-day field-entry chart |
| Review workflow | Schedule a site visit, mark verified after visiting, then approve — or reject with a note |
| Boundary approval | The community's polygon loads onto satellite imagery for the officer to **drag into agreement with their own survey**, or clear and redraw |
| Automatic parcelling | On approval the boundary is split into exactly one parcel per active member and assigned |
| Monitoring | Per-project parcel map, latest field entries with photos, participation, accrued carbon |
| Marketplace | Set a price, release verified tonnes for sale, review every retirement with its serial range |

---

## Tech stack

**Backend** — `express` ^4.19 · `pg` ^8.12 · `jsonwebtoken` ^9.0 · `bcryptjs` ^2.4 ·
`multer` ^2.0 (photo uploads) · `@turf/turf` ^7.1 (geodesic area, grids, clipping, union) ·
`pdfkit` ^0.15 (certificates) · `cors`, `dotenv`

**Frontend** — `react` ^18.3 · `react-router-dom` ^6.26 · `vite` ^5.4 · `tailwindcss` ^3.4 ·
`leaflet` ^1.9 + `react-leaflet` ^4.2 · `@geoman-io/leaflet-geoman-free` ^2.17 (polygon drawing) ·
`recharts` ^2.12 · `lucide-react` ^0.451

**Requirements** — Node.js 20+ (native `fetch`, ESM throughout) and PostgreSQL 14+.
**No PostGIS needed** — geometry is stored as GeoJSON in `jsonb`.

---

## Architecture

```
BROWSER  React 18 SPA (Vite)
  /              landing + marketplace + checkout      public
  /login         three-role sign-in and registration
  /admin  /leader  /member                             <Protected role="...">

  AuthProvider  JWT in localStorage, /auth/me on boot
  MapCanvas     Leaflet shell, three basemaps, fit-to-geometry
  AreaDrawer    geoman polygon tracer + toolbar
  ParcelLayer   parcel polygons, status colours, labels
        |
        |  fetch /api/*   (Vite proxies in dev)
        v
EXPRESS API
  middleware  authenticate -> verify JWT      requireRole(...) -> 403
  routes/     auth · communities · applications · admin · leader · member · market
  lib/        auth.js (bcrypt, JWT, guards)
              geo.js (hectares, splitIntoChunks, carbonEstimate)
              credits.js (member + leader settlement)
              certificate.js (PDFKit retirement certificate)
        |
        |  pg Pool, transactions where it matters
        v
POSTGRESQL   users · communities · community_members · applications · projects
             chunks · daily_entries · credits · listings · orders
             uploads/ <- daily photos, served at /uploads
```

**Two operations run inside explicit transactions**, because a partial result would corrupt the
registry:

1. **Approving an application** — insert the project, insert every parcel, flip the application to
   approved. Either the whole project exists or none of it does.
2. **Buying credits** — `SELECT ... FOR UPDATE` on the listing, check remaining volume, allocate the
   serial block, insert the order, decrement the lot. Two simultaneous buyers cannot claim the same
   serials.

---

## Data model

All geometry is a **GeoJSON `Polygon` stored in `jsonb`** — a deliberate trade that removes the
PostGIS dependency at the cost of spatial `WHERE` clauses. Geometry work happens in `lib/geo.js`
with Turf instead.

> **[DBMS.md](DBMS.md)** has the full database reference: an ER diagram, every relationship with its
> cardinality and cascade behaviour, complete per-table schemas, the index and constraint catalogue,
> normalisation notes and transaction boundaries.

| Table | Key columns | Rules enforced by the database |
|---|---|---|
| `users` | `username` (3–24 chars, what leaders search by), `email`, `password_hash`, `full_name`, `phone`, `village`, `role` | `role` CHECK in `admin`/`leader`/`member`; unique username and email |
| `communities` | `name`, `leader_id`, `district`, `state` | `leader_id` **unique** — one community per leader |
| `community_members` | `community_id`, `user_id`, `status`, `invited_at`, `responded_at` | Partial unique index `WHERE status = 'active'` — nobody is active in two communities |
| `applications` | `proposed_area` (jsonb), `area_hectares`, `ecosystem`, `status`, `review_note`, `visit_date` | `status` flows `submitted` → `site_visit_scheduled` → `site_visited` → `approved`/`rejected` |
| `projects` | `code` (`BCR-2026-0001`), `boundary` (the **officer's** surveyed polygon), `area_hectares`, `sequestration_rate`, `start_date`, `duration_years` | `application_id` **unique** — one project per application |
| `chunks` | `label` (`A1`…`B3`), `geometry`, `centroid_lat/lng`, `area_hectares`, `assigned_to` | Label unique per project |
| `daily_entries` | `entry_date`, `photo_path`, `temperature_c`, `humidity_pct`, `soil_moisture_pct`, plus optional `soil_ph`, `salinity_ppt`, `saplings_planted`, `watered`, `notes` | **`(chunk_id, entry_date)` unique** — one entry per parcel per day |
| `credits` | `role`, `credit_date`, `amount`, `participation_rate` | **`(user_id, credit_date, role)` unique** — one credit row per person per day per role |
| `listings` | `tonnes_available`, `tonnes_sold`, `price_per_tonne`, `vintage_year`, `status` | |
| `orders` | `reference`, buyer fields, `beneficiary`, `tonnes`, `subtotal`/`fee_amount`/`tax_amount`/`total_amount`, `payment_method`, `payment_reference`, `serial_start`/`serial_end`, `retired_at` | `reference` unique — it is the public certificate key |

> Order settlement columns were added after the first release, so `schema.sql` carries them as
> idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. `npm run migrate` upgrades an
> existing database in place — it never needs a drop.

---

## The credit and carbon model

### Credits

| Who | Rule | Example |
|---|---|---|
| **Member** | `1.0` credit for each complete daily entry | photo + 3 readings filed → `1.00` |
| **Leader** | `2.0 × (parcels reported ÷ parcels assigned)` for that day | 8 of 10 report → `2 × 0.8 = 1.60` |

In a ten-household collective where eight report, the day creates `8 × 1.00 + 1.60 = 9.60` credits.

The leader is deliberately paid on the *whole community's* reliability — chasing the two missing
parcels is their job, and the system gives them the list and the phone numbers to do it.
`settleLeaderCredit()` runs on **every member submission** and upserts the leader's row for that
date, so a member filing late in the evening immediately raises the leader's credit for the day.

### Carbon

```
grossTonnes    = area_hectares x sequestration_rate x elapsed_years
verifiedTonnes = grossTonnes x lifetime_participation
```

| Ecosystem | Rate (tCO2e / ha / yr) |
|---|---|
| Mangrove | 6.5 |
| Salt marsh | 5.2 |
| Seagrass meadow | 3.9 |

`lifetime_participation` is the mean daily share of parcels that actually reported, averaged over
every stored `participation_rate`. A community that reports on 84% of days can sell 84% of its
modelled tonnes, and no amount of assertion changes that number — it is computed from filed rows.

**Worked example** — 140.8 ha of mangrove, two years in, 84% participation:

```
140.8 x 6.5 x 2.0 x 0.84  =  ~1,538 tCO2e sellable
```

Constants live in `server/src/lib/geo.js` and `server/src/lib/credits.js`.

> These rates are literature averages. A production registry would substitute species- and
> site-specific factors with an independent verifier's sign-off.

---

## Parcel splitting

When an officer approves an application, `splitIntoChunks(boundary, memberCount)` turns one polygon
into exactly one parcel per member:

1. One member → return the whole boundary.
2. Lay a **square grid** over the bounding box at roughly a quarter of the target parcel area (about
   four candidate cells per member). The bbox is padded by one cell so `squareGrid` cannot drop edges.
3. **Clip every cell to the boundary** with `turf.intersect` — clipping rather than discarding edge
   cells is what keeps 100% of the area covered.
4. Sort north→south then west→east, so labels read like a map (`A1`, `A2`, … `B1`).
5. **Merge down**: repeatedly union the *smallest* remaining cell into its *nearest* neighbour until
   exactly `memberCount` parcels remain. Smallest-first keeps parcels comparable in size;
   nearest-neighbour keeps them contiguous.

Measured on the seeded 140.8 ha Sundarbans boundary:

| Members | Area covered | Smallest | Largest | Time |
|---|---|---|---|---|
| 1 | 100.0% | 140.81 ha | 140.81 ha | 1 ms |
| 3 | 100.0% | 28.65 ha | 56.41 ha | 12 ms |
| 10 | 100.0% | 7.99 ha | 19.81 ha | 18 ms |
| 25 | 100.0% | 3.19 ha | 10.42 ha | 41 ms |

A small 7.0 ha boundary gives full coverage at every member count too. An earlier version
binary-searched the cell size and was both lossy (69–89% coverage) and slow enough to hang; the
current deterministic sizing plus merge-down is what fixed it.

---

## Marketplace and credit transfer

Buyers **do not need an account** — they fill in a form, pay, and receive a certificate.

```
subtotal = tonnes x price_per_tonne
fee      = subtotal x 4%     (registry and verification)
tax      = fee x 18%         (GST applies to the service fee, not the credits)
total    = subtotal + fee + tax
```

Rates live in the `PRICING` constant in `market.routes.js` and are served at `GET /api/market/pricing`,
so the buyer's preview and the server's charge cannot drift. The server always recomputes.

Credits sell in **whole tonnes** so each carries an exact serial number. The order endpoint returns a
`settlement` array of what actually happened, in order, with timestamps — the UI reveals them one at
a time as a progress trail:

| # | Step | What really happens |
|---|---|---|
| 1 | Payment authorised | Method-specific validation, payment reference minted (`CARD-…`, `UPI-…`, `NB-…`) |
| 2 | Funds captured | Total including fee and GST |
| 3 | Credits reserved | Listing locked `FOR UPDATE`, volume checked, `tonnes_sold` incremented |
| 4 | Serial numbers assigned | `serial_start = floor(sold_before) + 1`, contiguous, never overlapping |
| 5 | Transferred to buyer | Held for the named beneficiary |
| 6 | Credits retired | `retired_at` set — permanently cancelled, cannot be resold or double-counted |
| 7 | Certificate issued | Public reference returned |

Payment methods: **card**, **UPI** (VPA), **net banking**.

### The certificate

A real A4-landscape PDF from `server/src/lib/certificate.js` (PDFKit). Both endpoints are public —
the reference is the key, so the link works from an email with no login:

```
GET /api/market/orders/:reference                  ->  JSON, for verification
GET /api/market/orders/:reference/certificate.pdf  ->  the PDF download
```

It carries the registry mark, reference, beneficiary, volume, community and location, a four-across
detail grid, a highlighted serial band such as `BCR-2026-0001-000075 to BCR-2026-0001-000086`, and a
verification URL.

> PDFKit's built-in Helvetica and Courier faces are WinAnsi-encoded and silently drop anything
> outside that set, so all certificate copy is ASCII — `INR` not the rupee sign, `tCO2e` not a
> subscript two. Embedding a real font lifts that restriction.

---

## Maps

Everything runs on **Leaflet** with tile providers that need **no API key and no account**.

| Layer | URL template | Attribution required |
|---|---|---|
| **Satellite** (default) | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Esri, Maxar, Earthstar Geographics |
| **Dark** | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | OpenStreetMap contributors, CARTO |
| **Streets** | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | OpenStreetMap contributors |

Satellite is the default everywhere, because tidal flats, creeks and planting rows are only legible
on imagery. All three live in one object in `client/src/components/MapCanvas.jsx`, with a switcher on
every map. To add a keyed provider (MapTiler, Stadia and Thunderforest all have free tiers), add one
entry to `BASEMAPS`:

```js
maptiler: {
  label: 'Terrain',
  url: `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${import.meta.env.VITE_MAPTILER_KEY}`,
  attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
  maxZoom: 20,
},
```

> **If you deploy this publicly:** OpenStreetMap's own tile server has a
> [usage policy](https://operations.osmfoundation.org/policies/tiles/) and is not meant for
> production traffic, and Esri's imagery should be used per their terms. Move to a keyed provider's
> free tier for real traffic.

**Drawing** uses [`@geoman-io/leaflet-geoman-free`](https://github.com/geoman-io/leaflet-geoman)
(MIT), wrapped into a single-polygon tracer with Draw / Undo point / Clear and a live hectare
readout. It is used twice: by the leader when applying, and by the officer when approving — where the
community's polygon is pre-loaded so its vertices can be dragged to match the real survey.

Parcel colours: **emerald** = reported for the selected day, **amber dashed** = assigned but not yet
reported, **slate** = unassigned, **cyan** = the signed-in member's own parcel.

---

## Design

Two deliberate identities: **light editorial** for the public page and sign-in, and a **dark ocean
console** for all three dashboards, because satellite maps and data overlays read far better on dark.
Colour ramps live in `client/tailwind.config.js` (`abyss`, `tide`, `sun`, `sand`); **Fira Sans** for
UI and **Fira Code** for anything numeric, with a `.tabular` utility so figures never jitter.

Accessibility: visible focus rings, `aria-label` on every icon-only control, `role="alert"` on errors,
a full `prefers-reduced-motion` block, SVG icons throughout (never emoji), 44px touch targets, and
breakpoints at 375 / 768 / 1024 / 1440.

---

## Getting started

### Prerequisites

```bash
node --version    # v20 or newer
psql --version    # PostgreSQL 14 or newer
```

### 1. Clone and install

```bash
git clone https://github.com/prabhu-omkar/BlueCarbon.git
cd BlueCarbon
npm run install:all          # installs both server/ and client/
```

### 2. Create the database

```bash
createdb bluecarbon
# or, if createdb is not on your PATH:
psql -U postgres -c "CREATE DATABASE bluecarbon"
```

On Windows, `psql` usually lives at `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`.

### 3. Configure the server

```bash
cp server/.env.example server/.env
```

```ini
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/bluecarbon
PORT=4000
JWT_SECRET=replace-with-a-long-random-string
CLIENT_ORIGIN=http://localhost:5173
PUBLIC_URL=http://localhost:4000
```

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | **Required.** Postgres connection string |
| `PORT` | `4000` | API port |
| `JWT_SECRET` | `dev-secret` | **Change in production.** Session token signing key |
| `CLIENT_ORIGIN` | any | Comma-separated CORS allow-list |
| `PUBLIC_URL` | request origin | Base URL printed on certificates |
| `PGSSL` | — | Set to `true` for hosted Postgres requiring SSL |

### 4. Build the schema and load demo data

```bash
npm run db:reset
```

This drops and recreates every table, then seeds a government officer, two leaders and sixteen
members; a **live project** (`BCR-2026-0001`, 140.8 ha in the Sundarbans, 10 parcels,
**30 days of monitoring history** at roughly 85% participation); an open marketplace lot of
148.5 tCO2e; a **second community awaiting approval** so the officer flow is demonstrable; and a
member with no community so the invitation flow is too.

```bash
npm --prefix server run migrate      # apply schema without dropping (idempotent)
npm --prefix server run seed         # seed only
npm run db:reset                     # drop + recreate + seed
```

### 5. Run it

```bash
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173
```

Open **http://localhost:5173**. Vite proxies `/api` and `/uploads` to the server, so there is no CORS
configuration to worry about in development.

### 6. Production build

```bash
npm run build          # client -> client/dist
npm --prefix server start
```

Serve `client/dist` from any static host pointed at the API, or serve both from one origin behind a
reverse proxy — the latter is simpler, since `/uploads` paths are stored origin-relative.

---

## Login credentials

**Every seeded account uses the password `password123`.**

Pick the matching role tab on the sign-in page first — logging in through the wrong tab is rejected
on purpose, with a message telling you which role the account actually holds.

### Government officer

| Username | Password | Name | What you'll see |
|---|---|---|---|
| `admin` | `password123` | Dr. Meera Iyer | Overview, review queue with a pending application, live projects, marketplace orders |

Government accounts cannot be self-registered — the sign-in page says so on the Government tab.

### Community leaders

| Username | Password | Name | Community | Notes |
|---|---|---|---|---|
| `leader` | `password123` | Ashoke Mondal | Gosaba Tidal Collective | Live project, 10 parcels, 30 days of data |
| `leader2` | `password123` | Sabita Nayak | Rajnagar Mangrove Sangha | Application awaiting approval |

### Community members

| Username | Password | Name | Village | Notes |
|---|---|---|---|---|
| `aparna.d` | `password123` | Aparna Das | Gosaba | Parcel A1 — **the one to use** |
| `sujit.m` | `password123` | Sujit Mondal | Gosaba | |
| `rekha.b` | `password123` | Rekha Barman | Pakhirala | |
| `nirmal.s` | `password123` | Nirmal Sardar | Pakhirala | |
| `pratima.h` | `password123` | Pratima Halder | Dayapur | |
| `bikash.n` | `password123` | Bikash Naskar | Dayapur | |
| `jhuma.p` | `password123` | Jhuma Patra | Satjelia | |
| `tapan.r` | `password123` | Tapan Roy | Satjelia | |
| `mousumi.g` | `password123` | Mousumi Ghosh | Satjelia | |
| `debu.k` | `password123` | Debabrata Kayal | Rangabelia | |
| `newmember` | `password123` | Ritesh Kar | Gosaba | **No community** — use this to test invitations |

The Rajnagar community also has six members (`santosh.j`, `lipika.s`, `harish.b`, `sarita.m`,
`ranjan.p`, `bimal.o`), same password.

> The seed deliberately leaves a couple of parcels unreported for today, so whether `aparna.d` sees
> the entry form or the "today is complete" card depends on the day. If it is already filed, sign in
> as whoever appears in the leader dashboard's **Not reported** panel.

---

## Walkthroughs

**Approve an application and watch parcels appear (2 min).** Sign in as `admin` → Applications →
*Rajnagar creek-side restoration*. The community's polygon is already on the map — drag its vertices
and the hectare readout updates live. Optionally Schedule visit, then Mark verified. Click
**Approve and create 6 parcels**; you land on the new project page with six labelled parcels. Sign in
as `leader2` to see it as their dashboard.

**File an entry and watch the leader's credit move (1 min).** As `leader`, note the *Your credit for
the day* tile (say `1.60 of 2`) and a username from the **Not reported** panel. Sign in as that
member, upload any photo, enter the three readings, submit. Back as `leader`, the reported count,
participation meter and credit tile have all moved.

**Buy credits and download a certificate (1 min).** From the landing page → Marketplace → **Buy
credits**. Pick whole tonnes (the fee and GST breakdown updates live), enter buyer details, choose
card / UPI / net banking, then watch the seven settlement steps confirm one by one and hit **Download
certificate**. Sign in as `admin` → Marketplace to see the order with its serial range.

**Start a community from nothing (3 min).** Sign-in page → Leader → Create an account → create the
community → search `newmember` and send a request → accept it as `newmember` → back as the leader,
trace an area and submit → approve it as `admin`.

---

## API reference

Base URL `/api`. Authenticated routes expect `Authorization: Bearer <token>`.
Errors are always `{ "error": "A human-readable sentence" }`.

| Method | Route | Auth | Notes |
|---|---|---|---|
| `POST` | `/auth/register` | — | `username, email, password, fullName, phone?, village?, role` (`leader`\|`member`). Rejects usernames outside `^[a-z0-9_.]{3,24}$`, passwords under 8 chars, duplicates (409), and self-registering as `admin` |
| `POST` | `/auth/login` | — | `username, password, role?` — asserts the role if given |
| `GET` | `/auth/me` | any | Current user |
| `POST` | `/communities` | leader | One community per leader (409 otherwise) |
| `GET` | `/communities/mine` | leader | Community + roster + latest application + project |
| `GET` | `/communities/search-members?q=` | leader | Min 2 chars; flags members already in a community |
| `POST` | `/communities/invite` | leader | `{ userId }`; enforces the 25-member cap |
| `DELETE` | `/communities/members/:userId` | leader | Blocked once the project is live |
| `GET` | `/communities/invitations` | member | Pending invitations |
| `POST` | `/communities/invitations/:id/respond` | member | `{ accept: true \| false }` |
| `POST` | `/applications` | leader | `{ title, ecosystem, area, notes }`. Needs ≥1 accepted member and >0.05 ha; area computed server-side |
| `GET` | `/applications/mine` | leader | This community's applications |
| `GET` | `/admin/overview` | admin | Counters plus a 14-day entry trend |
| `GET` | `/admin/applications?status=` | admin | Review queue |
| `GET` | `/admin/applications/:id` | admin | One application plus its active members |
| `PATCH` | `/admin/applications/:id/status` | admin | `{ status, reviewNote?, visitDate? }` |
| `POST` | `/admin/applications/:id/approve` | admin | `{ boundary, name?, startDate?, durationYears? }` — creates the project, splits parcels, assigns members. 409 if already approved |
| `GET` | `/admin/projects` · `/admin/projects/:id` | admin | Participation and accrued carbon; detail adds parcels and recent entries |
| `POST` | `/admin/projects/:id/list` | admin | `{ pricePerTonne, tonnes? }` — defaults to all verified tonnes |
| `GET` | `/admin/orders` | admin | Last 100 retirements |
| `GET` | `/leader/project?date=` | leader | Project, every parcel's status for that day, pending list, credits, carbon |
| `GET` | `/leader/chunks/:id?date=` | leader | One parcel: that day's entry plus 60 days of history |
| `GET` | `/leader/timeline` · `/leader/credits` | leader | 30-day series; ledger plus member leaderboard |
| `GET` | `/member/home` | member | Parcel, today's entry, 30-day history, totals, streak |
| `POST` | `/member/entries` | member | **multipart**: `photo` + `temperatureC`, `humidityPct`, `soilMoisturePct` (required), plus optional fields. Awards the member credit and re-settles the leader's |
| `GET` | `/member/credits` | member | Daily credit ledger |
| `GET` | `/market/pricing` · `/impact` · `/listings` | public | Rates; landing counters; open lots |
| `POST` | `/market/orders` | public | Checkout — returns `{ order, settlement[] }` |
| `GET` | `/market/orders/:reference[/certificate.pdf]` | public | Verification JSON, or the PDF |

Upload rules: JPEG / PNG / WebP / HEIC only (400), 8 MB max (413), one entry per parcel per day
(409), readings must be in range (400). `GET /api/health` reports API and database status.

---

## Project structure

```
BlueCarbon/
├── LICENSE  ·  README.md  ·  package.json (workspace scripts)
│
├── server/
│   ├── .env.example
│   └── src/
│       ├── index.js                app wiring, static uploads, error handler
│       ├── db.js                   pg pool, numeric parsers, one/many/tx helpers
│       ├── schema.sql              every table + idempotent ALTERs
│       ├── lib/
│       │   ├── auth.js             hashing, JWT, authenticate, requireRole, wrap
│       │   ├── geo.js              hectares, splitIntoChunks, carbonEstimate, rates
│       │   ├── credits.js          member/leader settlement, participation
│       │   └── certificate.js      PDFKit retirement certificate
│       ├── routes/                 auth · community · application · admin
│       │                           leader · member · market
│       ├── scripts/                migrate.js [--drop] · seed.js
│       └── ../uploads/             daily photos, served at /uploads
│
└── client/
    ├── index.html · vite.config.js (dev proxy) · tailwind.config.js
    └── src/
        ├── App.jsx                 routes + <Protected role="...">
        ├── index.css               tokens, component layer, Leaflet overrides
        ├── lib/                    api.js · auth.jsx · format.js · geo.js
        ├── components/
        │   ├── AppShell.jsx        dashboard chrome, tab strip, PageHead
        │   ├── ui.jsx              Badge, Panel, Stat, Alert, Meter, Spinner, Logo
        │   ├── MapCanvas.jsx       Leaflet shell, BASEMAPS, FitTo, LegendRow
        │   ├── AreaDrawer.jsx      geoman tracer + DrawToolbar
        │   ├── ParcelLayer.jsx     parcels, colours, labels, BoundaryLayer
        │   └── CheckoutDialog.jsx  volume, buyer, payment, settlement, certificate
        └── pages/
            ├── Landing.jsx         hero, impact, how, verification, market, FAQ
            ├── Login.jsx           three-role sign-in and registration
            ├── AdminDashboard.jsx  overview · applications · projects · orders
            ├── AdminApplication.jsx review, boundary tracing, approval
            ├── AdminProject.jsx    parcel map, entries, market release
            ├── LeaderDashboard.jsx project map by day, community, ledger
            └── MemberDashboard.jsx parcel, daily log, credits, history
```

---

## Security

**Implemented:** bcrypt password hashing (cost 10, hashes never returned); JWTs signed with
`JWT_SECRET`, 7-day expiry, verified on every protected route; `requireRole(...)` on every dashboard
route; parameterised SQL everywhere with no string interpolation; areas, credits and totals always
computed server-side; database-level integrity for the rules that matter (one active community per
member, one entry per parcel per day, one credit row per person per day per role, one project per
application); upload MIME allow-list and 8 MB cap; transactions with `FOR UPDATE` locking on
approval and checkout; generic 500 messages to clients with full errors kept in the server log.

**Not implemented, and it would matter in production:** rate limiting on login and checkout; email
verification and password reset; refresh-token rotation or server-side revocation; CSRF protection
(tokens live in `localStorage` and are sent explicitly, so the cookie-based vector does not apply,
but httpOnly cookies plus CSRF tokens would be stricter); signed URLs for photos; an audit log of
officer actions; EXIF or geotag verification that a photo was taken on the parcel it claims.

---

## Verification

No automated test suite yet. Verified by hand against a live database: parcel splitting from 1 to 25
members on two boundary sizes; registration, login and cross-role guards (403/401); the community
lifecycle and its application guards; approval creating one parcel per member with double-approval
rejected 409; daily entries with duplicate 409, out-of-range 400, non-image 400 and over-size 413,
plus leader credit re-settling correctly (8/10 → 1.60, 10/10 → 2.00); and the marketplace — fee
arithmetic to the paisa, serial continuity with no overlap, oversell and fractional-tonne rejection,
certificate lookup, and PDF output checked down to a coordinate dump of every text run.

**Not verified:** the rendered UI in a real browser — the client is checked by a clean production
build and code review only.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `password authentication failed` | Wrong `DATABASE_URL` password in `server/.env` |
| `database "bluecarbon" does not exist` | Run `createdb bluecarbon` first |
| `EADDRINUSE :::4000` | An old API is still running — `npx kill-port 4000` |
| Maps are blank grey | Tile hosts unreachable; switch basemap with the control at the top right |
| Photos show as broken images | API not running, or the client is on a port other than 5173 so the Vite proxy is out of play |
| "Today's reading has already been submitted" | By design. Use a member from the leader's *Not reported* list |
| Leader sees only the Community tab | That leader has no approved project — approve their application as `admin` |
| `npm run db:reset` wiped my data | That is what it does. Use `npm --prefix server run migrate` for non-destructive schema changes |

---

## Before production

- [ ] **Payments** — only authorise/capture is simulated. Replace that block in `market.routes.js`
      with a Razorpay or Stripe capture; steps 3–7 are already real
- [ ] **Photo storage** — move `uploads/` to S3 or GCS behind signed URLs
- [ ] **`JWT_SECRET`** — long and random, from a secret manager
- [ ] **HTTPS and same origin**, or an explicit `CLIENT_ORIGIN`
- [ ] **Rate limiting** on `/auth/login` and `/market/orders`
- [ ] **Payout disbursement** — the ledger a payout run reads is `credits`, grouped by `user_id`
      within `project_id`. Nothing moves money today
- [ ] **Sequestration factors** — site-specific values with an independent verifier's sign-off
- [ ] **Basemaps** — a keyed provider's free tier before taking real traffic
- [ ] **Backups, and an officer audit log**
- [ ] **Code splitting** — the bundle is ~1.1 MB (319 KB gzipped)

---

## License

Released under the [MIT License](LICENSE).

Basemap tiles remain the property of their providers — OpenStreetMap contributors, CARTO, and
Esri/Maxar/Earthstar Geographics — and must keep their attribution.

<div align="center">

**Blue Carbon Registry** · the coast stores the carbon, the village should earn from it

</div>
