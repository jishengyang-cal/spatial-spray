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
- Persistent local API state with refresh sessions and provider-login boundary.
- Spray stroke model with colors, nozzle, particles, overspray, drips, and AR decal mesh data.
- UGC moderation primitives: report, block user, owner delete, admin hide/remove, audit log, and location denylist.
- Web simulator for login, username, map discovery, clusters, camera spray canvas, and moderation actions.
- Native Apple source scaffold for iPhone AR spray and Vision Pro mixed immersive viewing.
- Mac Builder adapter scripts with local mock worker for native build job submission.

See `docs/architecture.md`, `docs/compliance.md`, and
`docs/workflows/apple-development.md`.

## Mac Builder Boundary

```bash
pnpm native:mac-builder:mock
SPATIAL_SPRAY_MAC_BUILDER_URL=http://127.0.0.1:4391 pnpm native:visionos-build:submit
```

The mock validates the request/response workflow. Real iOS and visionOS builds
still require a remote Mac with Xcode and signing material.
