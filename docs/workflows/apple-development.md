# Apple Development Workflow

This repository can develop the API, contracts, brush engine, and web
simulator on Linux. Native iOS and visionOS build, signing, Simulator,
TestFlight, and device testing require macOS and Xcode.

## Linux Loop

```bash
pnpm compliance:check
pnpm build
pnpm test:api
pnpm test:e2e
pnpm workflow:check
```

## Mac Builder Loop

Linux submits jobs through the adapter:

```bash
pnpm native:mac-builder:check
pnpm native:ios-build:submit
pnpm native:visionos-build:submit
```

Without `SPATIAL_SPRAY_MAC_BUILDER_URL`, the check reports missing capability
and exits without failing CI. For local protocol testing:

```bash
pnpm native:mac-builder:mock
SPATIAL_SPRAY_MAC_BUILDER_URL=http://127.0.0.1:4391 pnpm native:ios-build:submit
```

The real Mac worker runs the native commands:

```bash
xcodegen generate --spec native/apple/project.yml

xcodebuild \
  -project native/apple/SpatialSpray.xcodeproj \
  -scheme SpatialSprayiOS \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=iPhone 16 Pro" \
  build

xcodebuild \
  -project native/apple/SpatialSpray.xcodeproj \
  -scheme SpatialSprayVision \
  -configuration Debug \
  -destination "platform=visionOS Simulator,name=Apple Vision Pro" \
  -sdk xrsimulator \
  build
```

## iPhone AR Work

1. Use MapKit for nearby discovery.
2. Use ARKit world tracking with horizontal and vertical plane detection.
3. Use scene reconstruction when LiDAR is available.
4. Convert spray strokes into AR surface decals or mesh textures.
5. Upload spray metadata, strokes, preview, location, and anchor payload.
6. Reopen the same piece through nearby lookup and AR anchor resolution.

Current source includes an ARKit/RealityKit gesture surface that raycasts from
touches, renders paint dots, and publishes stroke data to the API.

## Vision Pro Work

1. Use SwiftUI window surfaces for login, map/list, and moderation actions.
2. Use RealityKit and ARKit providers for spatial creation and viewing.
3. Keep spray creation in mixed immersion first so the real world remains
   visible.
4. Use attachments only for UI panels; spray art should be native RealityKit
   content attached to surfaces.
5. Validate all placement, scale, comfort, and performance on Apple Vision Pro.

Current source includes a mixed immersive RealityKit scene with a spray preview
wall and nearby spray panel. Real spatial persistence still needs device tests.

## Authentication Work

Production provider adapters must validate tokens server-side:

- Sign in with Apple
- Google Sign-In
- Facebook Login

Local `/auth/dev-login` is only for development and automated testing.

## Release Gate

Before TestFlight:

- Apple sign-in works when Google/Facebook sign-in are enabled.
- Privacy labels include location, camera, account identifiers, and UGC.
- Report and block flows are present.
- Moderation backend can hide/remove public pieces.
- Location denylist and audit log are operational.
- App copy states that spray paint is digital AR content only.
