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

## Vision Pro Work

1. Use SwiftUI window surfaces for login, map/list, and moderation actions.
2. Use RealityKit and ARKit providers for spatial creation and viewing.
3. Keep spray creation in mixed immersion first so the real world remains
   visible.
4. Use attachments only for UI panels; spray art should be native RealityKit
   content attached to surfaces.
5. Validate all placement, scale, comfort, and performance on Apple Vision Pro.

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
- App copy states that spray paint is digital AR content only.

