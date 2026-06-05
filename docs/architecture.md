# Spatial Spray Architecture

Spatial Spray is a cross-device AR social creation product. The core object is
a digital spray piece anchored to a real-world location and surface. The app
does not modify real buildings or property.

## Product Surfaces

- iPhone: sign-in, username, map discovery, camera AR spray creation, AR view.
- Apple Vision Pro: sign-in, nearby discovery, spatial spray creation, mixed
  immersive viewing.
- Web simulator: Linux-runnable product loop for contracts, API, map behavior,
  and spray brush prototyping.
- Admin console: moderation and location policy control plane.
- Mac Builder adapter: remote build/test/archive control plane for native
  Apple work.

## Planes

```text
Client plane
  iPhone App
  Vision Pro App
  Web Simulator

API plane
  Auth adapter
  Username service
  Spray service
  Nearby geo query
  Moderation service
  Block/report service

Data plane
  User profiles
  Provider identities
  Sessions and refresh tokens
  Spray pieces
  Anchor payloads
  Reports
  Block lists
  Location denylists
  Audit events
  Media previews

Workflow plane
  Linux CI
  Mac Builder mock
  Remote Mac Builder
  Artifact/log refs
```

## Identity

The product supports Apple, Google, and Facebook sign-in. Because third-party
social login is part of account creation, Apple sign-in remains a first-class
provider. Real provider SDK credentials are external configuration and must not
be committed.

The first API implementation uses `/auth/dev-login` to validate the app flow
without provider secrets. Production adapters must verify provider tokens
server-side before issuing Spatial Spray sessions.

## Username

After first sign-in, users must claim a unique username before publishing. The
API enforces:

- lowercase letters, numbers, and underscore
- 3-24 characters
- reserved-name deny list
- unique normalized index

## Spray Piece

Each piece contains:

- owner and username
- geo point and geohash
- anchor provider and surface pose
- editable spray strokes
- visibility
- moderation status
- optional preview image URL

The first brush engine models spray with particles, overspray, opacity,
nozzle profile, and drips. Native rendering should map the same stroke model to
RealityKit decals, materials, mesh textures, or Metal-backed custom materials.

## Location and Anchoring

Discovery is a two-step model:

1. Geo discovery: query nearby public spray pieces by distance.
2. AR resolution: scan the nearby physical surface and resolve an anchor.

Supported anchor providers are modeled as:

- `arkit-geo`
- `arkit-world`
- `arcore-cloud`
- `visual-vps`
- `manual-local`

The MVP stores `manual-local` anchors and surface poses. Production location
precision must be upgraded gradually; do not promise global centimeter-accurate
placement until device tests prove it.

## Moderation

The system includes report and block primitives from the first version.
The current service also includes owner delete, admin hide/remove,
location denylist, and audit log primitives. Production must add:

- content review queue
- user suspension
- owner/takedown request workflow
- media scanning for preview images
- policy audit log

## Native Build Boundary

The repo contains iOS and visionOS source, but native build execution is an
adapter call. The Linux workflow can submit a `MacBuildRequest` and poll a
`MacBuildJob`; the real worker must run XcodeGen, xcodebuild, simulator tests,
archives, signing, and artifact collection on macOS.

## Current Implementation

- `packages/contracts`: shared data contracts and validation helpers.
- `packages/brush-engine`: spray particle, drip, material, and decal mesh generation.
- `services/api`: persistent local API with auth sessions, nearby discovery,
  clusters, UGC moderation, location denylist, and audit log.
- `apps/web-simulator`: product simulator with map, camera, and admin flows.
- `native/apple`: iOS AR and visionOS mixed immersive source scaffold.
- `scripts/mac-builder-*.mjs`: remote Mac Builder client and local mock.
