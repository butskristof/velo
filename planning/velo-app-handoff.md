# Velo Antwerpen station finder — handoff brief

Status: pre-implementation. This document captures research, decisions, and known
constraints from the design conversation. It is a **starting point for planning**,
not a plan. Backlog, sequencing, and task breakdown happen in Claude Code.

---

## 1. Problem

The official Velo Antwerpen station map (`velo-antwerpen.be`) is poor on mobile,
which is where it is used most. Specific failures:

- **No proximity answer.** Address search drops a pin on a Google map and leaves
  you to find the nearest station yourself by eye.
- **Visual ambiguity.** Orange station pins sit on a Google basemap whose POI
  markers for restaurants and bars are also orange.
- **Unbounded search.** Address search resolves anywhere on earth, despite Velo
  being a strictly bounded system.
- **Opaque freshness.** Responses are browser-cached with no indication of how
  stale the availability numbers are.

### Primary use cases

1. **Departure** — nearest station *with available bikes* to where I am now.
2. **Arrival** — nearest station *with free docks* to where I am going.

Use case 2 is driven by POI/destination search ("OLT Rivierenhof", a bar, a
square), not by station name. This is the harder and more valuable half.

---

## 2. Data source

### Decision: GBFS, not the site's private API

Velo is operated by Clear Channel (Smartbike) and publishes a **GBFS 2.0** feed.
GBFS is the open standard for shared-mobility data. Prefer it over the private
`velo-antwerpen.be/api/map/*` endpoints, which are the official site's own BFF —
undocumented, unversioned, and subject to change without notice.

**Discovery document:** `https://gbfs.smartbike.com/antwerp/1.0/gbfs.json`

```
last_updated: <epoch seconds>
ttl: 60
version: "2.0"
```

Feeds are published per language (`de`, `en`, `fr`, `nl`), each exposing exactly
three files:

```
https://gbfs.smartbike.com/antwerp/1.0/{lang}/system_information.json
https://gbfs.smartbike.com/antwerp/1.0/{lang}/station_information.json
https://gbfs.smartbike.com/antwerp/1.0/{lang}/station_status.json
```

**Consume the `en` feed.** Station names are Antwerp proper nouns and were
verified identical between the `nl` and `en` feeds. Station names are opaque data,
never translated content. UI language is handled by i18n independently.

### What is NOT in the feed

- No `system_pricing_plans` → **the 30-minute free window must be a config constant.**
- No `system_alerts` → no planned-closure information.
- No `vehicle_types` / `free_bike_status` → no e-bike vs. regular distinction.
- No `rental_uris` → no per-station deep link into the Velo app.
- No `license_url` or `license_id` → licensing is *unstated*, not granted or denied.
- No `num_bikes_disabled` / `num_docks_disabled` (optional in GBFS 2.0, not published).

### Sample payloads (captured, use as test fixtures)

`system_information.json` → `data`:

```json
{
  "system_id": "cc_smartbike_antwerp",
  "language": "en",
  "name": "Velo Antwerpen",
  "short_name": "Velo",
  "operator": "Clear Channel Belgium Velo Antwerpen, Mediaplein 7, 2018 Antwerp, Belgium",
  "url": "https://www.velo-antwerpen.be/en",
  "purchase_url": "https://www.velo-antwerpen.be/en/rates",
  "start_date": "2011-06-09",
  "phone_number": "+32 (0)3 206 50 30",
  "email": "info@velo-antwerpen.be",
  "timezone": "Europe/Brussels",
  "rental_apps": {
    "android": { "store_uri": "...", "discovery_uri": "https://www.velo-antwerpen.be/app" },
    "ios":     { "store_uri": "...", "discovery_uri": "https://www.velo-antwerpen.be/app" }
  }
}
```

`station_information.json` → `data.stations[0]`:

```json
{
  "station_id": "001",
  "name": "001- Centraal Station - Astrid",
  "short_name": "001",
  "lat": 51.21782,
  "lon": 4.42065,
  "address": "Koningin Astridplein",
  "post_code": "2018",
  "rental_methods": ["KEY"],
  "capacity": 33
}
```

`station_status.json` → `data.stations[0]`:

```json
{
  "station_id": "001",
  "num_bikes_available": 13,
  "num_docks_available": 18,
  "is_installed": true,
  "is_renting": true,
  "is_returning": true,
  "last_reported": 1786951665
}
```

Roughly 321 active stations.

### Data gotchas

- `station_id` is a **zero-padded string** (`"001"`). Never `parseInt` it as a key.
  Sort numerically via `short_name` if needed, but the string is the identity.
- `name` carries a `"001- "` prefix — no space before the dash, one after. Strip it
  by anchoring on `short_name`, not a loose regex. Keep both raw (for search
  matching) and display forms.
- `last_reported` and `last_updated` are **epoch seconds**, not milliseconds.
  Convert once, at the boundary.
- GBFS requires every station in `station_information` to appear in
  `station_status`. Defend against mismatches anyway — the merge must not throw.
- The private API returns `lat`/`lon` as **strings**; GBFS returns numbers. Relevant
  only if the two are ever hybridised.

---

## 3. Derived data — the differentiators

These are computable from the feed and are things the official site does not surface.

### Capacity gap as a health signal

`capacity - (num_bikes_available + num_docks_available)`

Station 001: `33 - (13 + 18) = 2`. Since disabled counts are not published, this
gap is broken equipment leaking through the arithmetic. A large gap indicates a
partially degraded station.

### Role-specific availability

The official map collapses everything into one grey "out of service" pin. The feed
gives three independent booleans:

- `!is_renting` → unusable as an **origin**, still fine as a destination.
- `!is_returning` → unusable as a **destination**, still fine as an origin.
- `!is_installed` → not present at all.

Grey out per role, not globally.

### Per-station staleness

`last_reported` is per station. A station that has not checked in for an hour while
its neighbours are current is suspect and should be marked, distinct from the whole
feed being stale.

### Availability confidence (later, not core)

Do not filter low-availability stations — rank with a soft penalty and a badge, so
a 1-bike station still wins if it is meaningfully closer. Keep the curve as a
tunable constant. Always show the runner-up with its delta, because arriving at an
empty rack is the normal failure mode.

### Service area polygon

**Derive it, do not hardcode a bbox.** Convex hull over all station coordinates plus
a walking buffer (~800m), recomputed whenever `station_information` changes. A
rectangle around Antwerp would include large amounts of Schelde plus Schoten and
Schilde where no stations exist; the real network is lopsided (port area north,
Linkeroever isolated west).

Serves three purposes: geocoder bias/filtering, an explicit "outside the Velo area"
state instead of a confusing empty list, and a sanity filter on geocoder results.

---

## 4. Architecture

### Settled

- **Nuxt 4 + Nitro, BFF-style.** Chosen because it is the best-known framework here;
  this project is not a vehicle for learning Next. No separate .NET service — there
  is nothing to persist and nothing Nitro cannot do.
- **The BFF earns its place** for reasons beyond CORS: it hides provider API keys,
  allows swapping providers without a client redeploy, collapses many clients into
  one upstream poll, and centralises the freshness calculation.
- **No persistence layer** initially. User preferences (favourites, recent
  destinations) go client-side. No station history logging.
- **Aspire (TypeScript AppHost)** for dev-time orchestration — brings up Nuxt
  alongside the Valhalla and Photon containers and provides a local OTLP endpoint
  and dashboard. Reuse the existing setup from the other project. Aspire is **not**
  the deployment story.
  - Use the generic JavaScript app resource, not `AddViteApp` — Nuxt runs its own
    dev server through Nitro and manages HMR itself.
  - Aspire injects `OTEL_EXPORTER_OTLP_ENDPOINT` but does not instrument Nitro.
    Wire `@opentelemetry/sdk-node` in a Nitro plugin.
- **Client-side distance ranking.** ~321 stations is a trivial dataset. Ranking runs
  locally on every position update — no round trip per GPS tick, and coordinates
  stay on device for this step.
- **Avoid Google.** Not primarily a cost decision (per-SKU free tiers would cover
  personal volume). Google's terms restrict caching geocoding results and prohibit
  displaying them on non-Google maps, making it all-or-nothing and incompatible with
  a self-hosted MapLibre basemap. Re-evaluate only if OSM quality proves inadequate.

### Refresh model

Feed `ttl` is 60s. That is the refresh floor — polling faster returns identical bytes.

- Server caches upstream fetches (`station_information` long, `station_status` ~55s).
- Compute the refresh delay **server-side** and return it to the client. Phone clock
  skew makes client-side `(last_updated + ttl) * 1000 - Date.now()` unreliable.
  Clamp to a sane range.
- TanStack Query: interval refetch while visible, `refetchOnWindowFocus: true`,
  `refetchIntervalInBackground: false`.
- **Stale-while-revalidate UX**: keep showing existing numbers, show a subtle
  updating indicator, replace values in place. Never blank the list or block on a
  spinner — old numbers beat no numbers.
- **Display freshness honestly** ("bike counts from 40s ago"). Return both the
  upstream `last_updated` and our own fetch time.

### Deliberately open

Do not over-specify these before there is running code and a feedback loop:

- Exact API surface and endpoint shapes — let it evolve.
- Precise client/server split for calculations beyond the ranking decision above.
- State management approach (probably composables + Query cache; **do not add Pinia**
  unless a concrete need appears).
- Deployment, hosting, scaling. Infrastructure must not influence design decisions —
  choose components on quality, not on container size. Initially runs at home.

---

## 5. Providers

Build a generic, swappable approach for geocoding, routing, and basemap — idiomatic
TypeScript, not a literal port of a C# interface. Normalise everything to local
domain types so the UI never sees a provider's shape. Keep providers server-side.
Make the active provider overridable per-request in dev so alternatives can be
A/B'd on a real phone during a real trip.

### Geocoding — Photon

Photon is built for type-ahead search (Elasticsearch-backed, handles partial words).
Nominatim's usage policy explicitly forbids per-keystroke autocomplete, so it is the
wrong tool here. Photon accepts a `bbox` for hard bounds plus `lat`/`lon` for
proximity bias — both fixes needed.

**Merge station names into the geocoder result list**, matched against both the
stripped descriptive name and `short_name` (so typing "47" finds station 047), and
visually distinguish the two result kinds.

> **This is the single biggest open risk.** OSM POI coverage for bars, restaurants,
> and venues is uneven, and this is where Google is genuinely better. See §8.

### Routing — Valhalla

One container serves both walking and cycling profiles, and its `sources_to_targets`
endpoint is the matrix call needed. OSRM is faster but single-profile per instance
and its public demo server is car-only.

**Why routing matters, concretely:** crow-flies distance is actively misleading in
Antwerp — the Schelde, the R1 ring, railway cuttings, and parks all break it. The
Rivierenhof case is the canonical example: the park's footpaths *are* in OSM, so a
walking-profile router correctly routes through the park to OLT, while crow-flies
suggests a station on the wrong side of a fence. Routing does not just improve the
number, it changes which station wins.

Pattern: haversine shortlist locally (free, instant) → matrix call for the top N
only. Display walking **time**, not crow-flies metres.

Use default cycling speed estimates initially. Leave a `SPEED_FACTOR = 1.0` constant
so correcting for heavy Velo three-speeds is a one-line change later.

### Basemap — MapLibre GL JS, provider TBD

Candidates: Protomaps (self-hostable `.pmtiles`), OpenFreeMap, MapTiler.

**The style is real work, not a config flag.** "POIs off, desaturated" means forking
a MapLibre style JSON and filtering layers by `source-layer` and id. OpenFreeMap
ships Positron/Bright/Liberty; Protomaps ships light/dark/grayscale. Budget actual
time — this is the fix for the original orange-on-orange complaint, and a default
style with a checkbox toggled will not deliver it.

Marker design: encode availability *in* the marker (count badge + colour ramp) so
the map is readable without tapping.

---

## 6. Cross-cutting concerns — build in from day one

Not a later phase.

- **i18n scaffolding immediately**, translations later. `@nuxtjs/i18n`, `nl` default,
  every user-facing string keyed from the first commit even while `nl` is the only
  locale. Format distances and times through `Intl`, never string concatenation.
- **Telemetry on the three things that inform decisions:** upstream fetch latency
  with cache hit/miss, geocode latency tagged by provider, routing latency tagged by
  provider and element count. These spans are how the Photon-vs-alternatives question
  gets answered with data rather than vibes. Adhere to OTel conventions so Grafana /
  SigNoz / whatever works later.
- **A degradation ladder, designed rather than caught.** Upstream down → last-known-good
  with a loud staleness banner. Geocoder down → station-name search still works.
  Router down → haversine fallback with a visible marker. This app gets used on mobile
  data in tunnels.
- **Fixtures now.** Snapshot the captured feed responses into `test/fixtures/`.
  Pure domain functions + fixtures = a cheap regression net.
- **Accessibility is not optional.** One-handed, outdoors, in sunlight, in a hurry.
  Large tap targets, high contrast, and a list view usable without the map.
- **Geolocation failure modes are designed, not caught.** The app must be fully usable
  with no GPS — permission denied falls back to a manual location pin (same mechanism
  as the destination pin, so it is cheap). Indoors, accuracy can be 500m, at which
  point "nearest station" is noise; surface the accuracy radius and say so.
- **Rate limiting** on geocoding and routing endpoints (per-IP bucket) — these are
  per-user and the only abuse surface. `/api/status` is server-cached so upstream
  load is flat regardless of client count.
- **OSM attribution** in the UI from the first map commit. Non-negotiable for
  OSM-derived tiles, geocoding, or routing.

---

## 7. Capability backlog — inspiration, not sequence

Treat as a dependency graph, not an ordered plan. The only hard edges: the domain
model comes first, and Photon quality must be known before committing to a search
design. Everything else can reorder freely. "Build the map earlier because it makes
the thing feel real" is a valid reason.

**Data foundation** — Nuxt + Nitro skeleton, cached upstream access, merged domain
model with derived health (capacity gap, role availability, staleness), freshness
envelope. Bare list sorted by haversine from `watchPosition`. *This alone beats the
official site for use case 1.*

**Map** — MapLibre, custom style with POIs off, count-in-marker with availability
colour, list and map linked bidirectionally.

**Destination search** — Photon with service-area bbox and proximity bias, station
names merged in, destination → nearest stations *with free docks*. Closes use case 2.

**Real walking distances** — Valhalla foot profile, haversine shortlist → matrix.
Where Rivierenhof and the Schelde stop lying. Show time, not metres.

**Quality of life** — favourites, recent destinations, PWA install, offline station
list, deep-link out to walking navigation, availability confidence scoring with
runner-up, manual pin drop with destination snapping (show when the snapped point is
far from the pin — the signal that the geocoder guessed badly, e.g. Groen Kwartier).

**Two-step planner** — the end goal. Full chain is
`walk (me → origin station) + bike (origin → destination station) + walk (destination station → destination)`.

> **Optimise the total, not each leg greedily.** Nearest-origin-first can lose: a
> station 100m further in the direction of travel can save 500m of cycling.
>
> Shortlist ~5 origin and ~5 destination candidates → one 5×5 bike matrix + two 1×5
> walk matrices → minimise total, applying availability penalties at both ends.
> Three routing calls, ~35 elements. Trivial.
>
> The 30-minute free window applies to the **bike leg only** (dock-to-dock). Nothing
> else tells you this.

---

## 8. First tasks

1. **Spike it.** No Aspire, no providers, no i18n, no tests. Fetch both feeds, merge,
   haversine, render an ugly list. Get it on the phone and **take an actual Velo trip
   with it.** That trip answers which capability to build first far better than any
   amount of planning. Then throw it away and build properly.

2. **Test Photon quality — this gates the search design.** Run five queries actually
   used in practice: "OLT Rivierenhof", a specific bar, "Groen Kwartier", a square, a
   friend's street. Against Photon (public instance is fine for a one-off test) and
   against Google as a baseline. If Photon returns 4/5, self-host it and move on. If
   it returns 2/5, the provider abstraction just earned its keep and there is a real
   decision to make.

3. **Verify the station count.** Compare `station_information.json` length against the
   ~321 the official site claims. If they match, the `whitelistStation` private
   endpoint can be ignored permanently (it is not a GBFS concept and will not be
   explained by the feed).

---

## 9. Out of scope / deferred

- **Licensing and public release.** Building for personal use. The feed has no stated
  licence — that is "unstated", not "prohibited". If public access is ever enabled,
  revisit: email `info@velo-antwerpen.be` (address is in the feed), attribute clearly,
  use `purchase_url` and `rental_apps` to drive signups to Velo, avoid their logo and
  any name suggesting officialness, do not monetise.
- **Deployment, hosting, scaling.** Explicitly not a design input.
- **Persistence / station history.** Logging `station_status` over time would enable
  "this station is usually empty at 08:15", but that is a later product.
- **`rental_methods` handling.** GBFS reports only `["KEY"]` and omits the
  mobile-checkout detail the private API carries. Not a practical concern — Velo
  stations generally support both card and app.
- **Bike-weight speed correction.** Constant left in place, calibrate later.

---

## 10. Design direction

Utility app, not many frills. Function-first. Detailed visual design is separate work
to be done with the dedicated design skill — do not invest in aesthetic decisions here
beyond what clarity requires (the basemap style work in §5 is a *functional*
requirement, not a stylistic one).
