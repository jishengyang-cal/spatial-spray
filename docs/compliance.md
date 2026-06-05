# Compliance and Store Review Boundary

Spatial Spray combines social login, location, camera/AR, user-generated
content, and public-space discovery. These areas must be designed as product
requirements, not late-stage patches.

## Required User Controls

- Report a spray piece.
- Block a user.
- Delete or hide your own spray pieces.
- View why location and camera permissions are needed.
- Avoid revealing exact live location of other users.

The MVP implements reporting, blocking, owner deletion, admin hide/remove,
location denylist, and moderation audit primitives. A production release still
needs an operated admin moderation queue, escalation rules, and support
workflow.

## Location Policy

The app stores spray piece locations, not continuous user tracking. Clients
should request when-in-use location permission and send approximate user
position only for nearby queries and creation.

Production must support:

- coordinate precision reduction for public listing
- exact anchor payload only after user is physically nearby
- private-property and sensitive-location takedown workflow
- location exclusion zones for schools, hospitals, government buildings,
  residential addresses, and user-configured banned areas

## User Generated Content

Public spray pieces are UGC. Production must include:

- report flow
- block flow
- admin moderation queue
- owner delete flow
- location denylist
- moderation audit log
- abuse detection
- removed/hidden status
- repeat-offender user enforcement
- privacy policy and content policy

## Authentication

Apple, Google, and Facebook are supported providers. Apple sign-in must remain
available whenever Google or Facebook sign-in can create the same user account.
Provider client IDs, secrets, key IDs, team IDs, signing keys, and Facebook app
secrets must not be committed.

## Real-World Property Boundary

The app creates digital overlays only. Product copy, UI, and review notes must
avoid suggesting permission to vandalize or modify real property.

## Apple References

- App Store Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
- Sign in with Apple:
  https://developer.apple.com/sign-in-with-apple/
- App privacy details:
  https://developer.apple.com/app-store/app-privacy-details/
- Running apps in Simulator or on device:
  https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device
- ARKit:
  https://developer.apple.com/augmented-reality/arkit/
