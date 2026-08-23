# MemoryAssist

**Helping familiar faces stay familiar.**

MemoryAssist is a privacy-first assistive web application that helps people
with memory impairment recognize the people who matter most. A caregiver adds
familiar people — a photo, a name, a relationship, one kind sentence — and
Companion Mode then uses the device camera to recognize them **entirely on
the device**, displaying their name in large, calm text with optional gentle
voice guidance.

> MemoryAssist is a prototype assistive technology, **not a medical device**.
> Recognition may be incorrect — always confirm identity when it matters.

---

## Why this matters

Dementia and memory impairment can make even beloved family members feel like
strangers. Cloud facial-recognition exists, but sending an elderly,
vulnerable person's live camera feed to a server is a privacy and dignity
problem — and it stops working offline.

MemoryAssist takes a different path: **the entire recognition pipeline runs
in the browser**, for free, with zero paid APIs and zero cloud services.
The same architecture maps directly onto smart glasses in the future — the
recognition engine already returns a plain result (a person), independent of
how it's displayed.

## Features

| Area | What you get |
| --- | --- |
| Caregiver mode | Dashboard of trusted people, guided add-person wizard, profile pages |
| Enrollment | Photo upload **or live camera capture**, local face detection, multi-photo support (2–4 recommended) |
| Companion mode | Full-screen camera experience, large identity card, relationship + description |
| Honest recognition | Unknown people stay unknown — nearest-neighbor never wins by default |
| Stability | Temporal smoothing + majority voting so identities don't flicker |
| Voice guidance | Browser-native speech announces *"Fatima. Your Mother."* with cooldowns |
| Accessibility | Large text, high contrast, reduced motion, keyboard navigable, screen-reader friendly |
| Privacy center | Live facts about what is stored where; delete-all with confirmation |
| Data portability | Export/import a validated JSON backup (contains sensitive data — keep private) |
| Offline / PWA | Installable app; after first visit everything — including ML models — works offline |
| Demo mode | Clearly-labeled demo people (no recognition data) for judging/exploration |

## Architecture

```
                 MEMORYASSIST
                      │
         ┌────────────┴────────────┐
     CAREGIVER                 COMPANION
         │                         │
    Profiles                   Camera (getUserMedia)
         │                         │
   Photo upload or             Face detection
   live capture                (TinyFaceDetector)
         │                         │
   Local face descriptor       Descriptor (128-D)
         │                         │
         └────────────┬────────────┘
                LOCAL RECOGNITION
      IndexedDB profiles → Euclidean matching
                      │
              Threshold filter  → "unknown" wins over wrong identity
                      │
            Temporal stabilization (majority vote + hold)
                      │
              ┌───────┴────────┐
           Identity card     Voice (Web Speech API)
```

### The recognition pipeline

```
camera frame (sampled ~4×/s, inference never overlaps)
  ↓
TinyFaceDetector at ADAPTIVE resolution (320/256/224, latency-driven governor)
  ↓
68-point landmarks → 128-D face descriptor (face-api.js / TensorFlow.js)
  ↓
L2-normalized open-set matching against every enrolled descriptor
  ↓
three safety layers:
  ① threshold gate        best distance ≤ T (balanced 0.55 ≈ cos θ ≥ 0.85)
  ② ambiguity margin      if two people are near-equidistant in the
                          uncertainty band → refuse to guess
  ③ logistic confidence   c = σ(k·(T−d)) weights each piece of evidence
  ↓
IoU box tracker + per-coordinate One-Euro filtering (calm overlays)
  ↓
temporal stabilization — exponentially-decayed evidence voting with
Schmitt-trigger hysteresis (enter ≥ 2.15, exit < 0.9, τ = 650 ms):
identities appear after several agreeing frames, ride through dropouts,
and switch only when a newcomer independently wins
  ↓
UI state + speech announcement (30 s cooldown per person)
```

**Recognition mathematics**

- **Direction-only comparison.** Descriptors are L2-normalized; Euclidean
  distance on unit vectors equals `√(2−2·cos θ)`, making matches purely
  angular and magnitude-invariant.
- **Open-set safety.** A Lowe-style margin test rejects ambiguous frames:
  when `secondBest − best` is small *and* the best distance sits inside the
  uncertainty band `[0.42, 0.62]`, the frame abstains instead of voting.
- **Calibrated evidence, not votes.** Each frame contributes its logistic
  confidence to an accumulator that decays as `e^(−Δt/τ)`; hysteresis bands
  prevent flicker at decision boundaries.
- **One-Euro filtering** (Casiez et al., CHI 2012) keeps tracked face boxes
  smooth at low speed yet responsive to fast movement.
- **Adaptive compute**: an EWMA of real inference latency promotes/demotes
  detector resolution tiers with a change cooldown.
- **Enrollment quality gates**, computed locally: Laplacian-variance blur
  measure, mean-luminance exposure check, and a landmark-geometry yaw proxy.

**Safety rule:** if the best match is above threshold or ambiguous, the
system says *"I don't recognize this person yet"* rather than guessing.
A wrong name is more harmful than an honest unknown.

### Where your data lives

| Data | Location | Leaves the device? |
| --- | --- | --- |
| Profiles, relationships, descriptions | IndexedDB (`memoryassist-db`) | Never |
| Photos (blobs) | IndexedDB `assets` store | Never |
| Face descriptors (128 floats each) | IndexedDB, alongside each profile | Never |
| App settings | `localStorage` | Never |
| Camera frames | RAM only, processed in-page | Never |
| ML model weights | `/public/models`, cached by service worker | Downloaded once |

There is no backend, no account system, no analytics and no telemetry in this
project. Search the codebase: there is no `fetch` to any API in the
recognition path.

## Technology stack

- [Next.js 14](https://nextjs.org) (App Router) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) design system (warm neutrals + teal accent, high-contrast theme)
- [Framer Motion](https://www.framer.com/motion/) — spring-physics UI: 3D tilt cards with glare, staggered hero reveals, `AnimatePresence` identity transitions, spring toasts/modals (all disabled under reduced-motion)
- [@vladmandic/face-api](https://github.com/vladmandic/face-api) (MIT) — maintained fork of face-api.js running on TensorFlow.js (Apache-2.0), WebGL-accelerated
- Pre-trained weights bundled in `public/models` (tiny face detector ≈190 KB, 68-point landmarks ≈350 KB, face recognition ≈6.2 MB)
- IndexedDB via a small hand-rolled promise wrapper (versioned schema, migration-ready)
- Web Speech API (voice), Wake Lock API, Service Worker + Web App Manifest (PWA)
- [Vitest](https://vitest.dev) + fake-indexeddb for unit tests

## Getting started

Prerequisites: **Node.js ≥ 18.17** and npm.

```bash
npm install          # install dependencies
npm run dev          # develop at http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint (next/core-web-vitals)
npm run typecheck    # tsc --noEmit
npm test             # vitest unit tests
npm run icons        # regenerate PWA icons into public/icons
```

> **Camera note:** browsers expose `getUserMedia` only in secure contexts —
> use `localhost` during development, or deploy over HTTPS (Vercel does this
> automatically). Nothing needs to be disabled; that's the point.

### Models

Model weights are already committed under `public/models/` (source:
[vladmandic/face-api `model/`](https://github.com/vladmandic/face-api/tree/master/model),
MIT). They load from `/models` at runtime and are then served from the
service-worker cache, which is why recognition works offline after the first
visit. No API keys are involved anywhere.

## Deployment

Static-friendly Next.js app — deploys to Vercel in one click:

1. Push this repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) (framework auto-detects Next.js).
3. Deploy. Open the URL over HTTPS, add a person, and use Companion Mode.

No environment variables are required. The app has no secrets because it has
no server-side dependencies.

## Project structure

```
app/                    # routes: landing, caregiver/, recognition/, settings/, privacy/, about/
components/
  layout/               # app shell, header, mobile bottom navigation
  ui/                   # button, card, inputs, modal, toast, empty states…
  people/               # cards, avatar, photo dropzone, camera capture
  recognition/          # companion view (camera stage, identity card, overlays)
lib/
  storage/              # IndexedDB wrapper + profile service + import/export validation
  recognition/          # config, model manager, detector, matching, stabilizer, enrollment
  camera/               # getUserMedia service with human-readable error mapping
  speech/               # voice guidance with cooldowns and cancellation
  settings/             # persisted preferences + accessibility classes
hooks/                  # useRecognition controller, useCamera, usePeople, useSettings
public/models/          # pre-trained face-api weights (bundled)
public/sw.js            # service worker (models & shell caching)
tests/                  # unit tests: matching, smoothing, speech, storage, import safety
```

## Testing

71 unit tests cover the parts that must never regress:

- **math core**: L2 normalization, cosine/normalized-distance identities,
  logistic confidence calibration
- descriptor matching, threshold behavior, **ambiguity-margin rejection** and
  **unknown rejection**
- temporal stabilization (enter delay, hysteresis ride-through, weak-evidence
  behavior, independent identity switching, unknown debounce)
- IoU geometry + box tracker association + One-Euro jitter suppression
- adaptive perf-governor tier changes and cooldowns
- enrollment quality gates (Laplacian sharpness, luminance, yaw proxy)
- voice guidance cooldown/dedup semantics
- backup import validation (malformed files are skipped safely,
  prototype-pollution immune, no HTML can enter as an image)
- IndexedDB profile lifecycle, cascade deletes, and corrupted-record
  sanitization

Run with `npm test`.

## SIH demo flow (60 seconds)

1. Open the site → short onboarding, privacy-first messaging.
2. Caregiver Dashboard → *Add first person* (or *Load demo people*).
3. Wizard: name “Fatima”, relationship Mother → upload a clear photo **or take one with the camera right there** → watch *“Face found”* appear locally.
4. Finish → profile shows *Recognition ready* with the stored face count.
5. Open **Companion Mode** → allow camera → Fatima walks in → after a few calm frames: big name + relationship, optional spoken announcement.
6. Bring in someone else → *"I don't recognize this person yet."*
7. Turn off Wi-Fi → everything still works (recognition is local).
8. Privacy Center → shows exactly what's stored and offers full deletion.

## Known limitations

- Single-device: profiles live in one browser (export/import is the bridge).
- Accuracy depends on lighting, angle and photo quality; 2–4 enrollment
  photos help. It is tuned to prefer "unknown" over risky guesses.
- Recognition runs at roughly 4 inferences/second on typical laptop hardware;
  very low-end devices may be slower (CPU fallback).
- iOS Safari requires the page to stay visible for camera processing, and
  speech availability varies by browser (feature-detected gracefully).

## Ethics

MemoryAssist is designed to help a specific person recognize consenting
family and friends, added by their caregiver, stored on their own device.
It must not be used for covert identification of people who haven't consented.
It makes no medical claims and does not replace human care.

## Roadmap

- Smart-glasses output adapter (the engine already decouples recognition from display)
- Optional encrypted backups, retention limits controlled by caregivers
- On-device quality hints during enrollment ("hold steady", "more light")

## License

MIT — see [LICENSE](LICENSE).
