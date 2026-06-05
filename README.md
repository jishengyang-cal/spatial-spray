# spatial-spray

Cross-device AR spray paint product scaffold for iPhone and Apple Vision Pro.

The product is a location-aware AR creation and discovery app:

- users sign in with Apple, Google, or Facebook and claim a unique username
- users create digital spray paint on real surfaces
- nearby spray pieces can be discovered by distance and map mode
- iPhone users can create and view with camera-based AR
- Vision Pro users can create and view in spatial AR

The repository is Linux-runnable for contracts, API, web simulator, compliance,
and tests. Native iOS/visionOS compilation requires macOS, Xcode, ARKit,
RealityKit, signing assets, and device or simulator access.

## Quick Start

```bash
pnpm install
pnpm workflow:check
pnpm test
pnpm dev
```

Default local URLs:

```text
api:           http://127.0.0.1:4301
web simulator: http://127.0.0.1:5177
```

## Current MVP

- Dev-mode provider login adapters for Apple, Google, and Facebook.
- Unique username reservation.
- Location-indexed spray piece creation and nearby lookup.
- Spray stroke model with colors, nozzle, particles, overspray, and drip data.
- UGC moderation primitives: report, block user, hide blocked creators.
- Web simulator for login, username, map discovery, and camera spray canvas.
- Native Apple source scaffold for iOS and visionOS handoff.

See `docs/architecture.md`, `docs/compliance.md`, and
`docs/workflows/apple-development.md`.
