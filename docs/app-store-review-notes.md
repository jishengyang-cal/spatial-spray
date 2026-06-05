# App Store Review Notes Draft

Spatial Spray is a digital AR creation app. Users place virtual spray paint
overlays on detected surfaces and discover nearby digital pieces. The app does
not modify physical property.

## Native Capabilities

- iPhone: ARKit camera view, surface raycast, spray stroke capture, map
  discovery.
- Apple Vision Pro: mixed immersive RealityKit view and nearby spray panels.
- Sign-in: Apple, Google, and Facebook are modeled. Sign in with Apple remains
  available wherever other social account creation providers are offered.
- Location: when-in-use location for nearby discovery and piece creation.

## UGC Safety

The product includes report, block, owner delete, admin hide/remove,
moderation audit log, and location denylist primitives. Production release
must connect these controls to real admin operations before public launch.

## Apple Toolchain Boundary

Linux CI validates contracts, API, web simulator, tests, compliance, and Mac
Builder job submission. Actual iOS/visionOS build, simulator, device install,
archive, signing, TestFlight, and App Store submission require macOS, Xcode,
Apple SDKs, Apple Developer Program access, and signing assets.

## Review Configuration

Before submission, configure real provider credentials, Sign in with Apple,
bundle IDs, provisioning profiles, privacy nutrition labels, location/camera
permission copy, content policy URL, privacy policy URL, and moderation contact
workflow outside this repository.
