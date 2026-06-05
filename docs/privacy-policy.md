# Privacy Policy Draft

Spatial Spray uses account, location, camera/AR, and user-generated content
data to let users create and discover digital spray pieces.

## Data We Process

- Account identity from Apple, Google, or Facebook after provider verification.
- Unique Spatial Spray username.
- Spray piece location, approximate discovery distance, surface anchor payload,
  stroke data, color/nozzle metadata, and optional preview media.
- Reports, blocks, moderation actions, and audit events.
- Device platform and app diagnostics needed to operate the service.

## Location

The app uses when-in-use location. It stores spray piece locations and anchor
metadata, not continuous live user tracking. Nearby discovery should use
coarsened coordinates for public listings and reveal exact anchor data only
when the user is physically near the target.

## Camera and AR

Camera and AR data are used to place digital overlays and resolve anchors.
Raw camera frames should not be uploaded unless a future feature explicitly
asks for permission and documents the purpose.

## User Controls

Users must be able to delete their own spray pieces, report public pieces,
block users, and request takedown or location exclusion review.

## Secrets

Provider client secrets, Apple private keys, signing certificates, provisioning
profiles, and App Store Connect API keys must not be committed to this repo.
