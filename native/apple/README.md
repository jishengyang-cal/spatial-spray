# Apple Native Client

This directory contains the iOS and visionOS source scaffold for Spatial Spray.

Linux can inspect and package these files. Native builds require macOS, Xcode,
ARKit, RealityKit, MapKit, signing assets, and either Simulator or physical
device access.

## Targets

- `SpatialSprayiOS`: iPhone app for sign-in, username, map discovery, camera
  spray creation, and AR viewing.
- `SpatialSprayVision`: Apple Vision Pro app for sign-in, nearby discovery,
  spatial spray creation, and immersive viewing.

## Mac Builder commands

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

The first implementation keeps provider login behind service adapters. Real
Apple, Google, and Facebook SDK configuration must be provided on the Mac
Builder through signed app configuration and must not be committed.

