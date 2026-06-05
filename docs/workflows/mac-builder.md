# Mac Builder Workflow

Spatial Spray keeps native Apple work behind an adapter boundary. Linux can
validate contracts, API, web simulator, compliance, and job submission. macOS
is only required for XcodeGen, xcodebuild, simulator, archive, signing, device
install, TestFlight, and App Store delivery.

## Local Mock

Run the mock worker:

```bash
pnpm native:mac-builder:mock
```

Submit a visionOS build job to the mock:

```bash
SPATIAL_SPRAY_MAC_BUILDER_URL=http://127.0.0.1:4391 pnpm native:visionos-build:submit
```

The mock returns `queued -> running -> succeeded` with log artifact refs. It
does not invoke Xcode.

## Real Remote Mac

The real worker should expose:

```text
GET  /health
POST /jobs
GET  /jobs/:id
```

`POST /jobs` accepts `MacBuildRequest` from `packages/contracts` and returns a
`MacBuildJob`. The worker must clone the requested repo/ref, run XcodeGen from
`native/apple/project.yml`, execute the requested Xcode build/test/archive, and
return log, `.xcresult`, archive, ipa, screenshot, or build-product artifact
refs.

Required environment on this Linux side:

```bash
export SPATIAL_SPRAY_MAC_BUILDER_URL=https://builder.example.com
export SPATIAL_SPRAY_MAC_BUILDER_TOKEN=...
```

Scripts:

```bash
pnpm native:mac-builder:check
pnpm native:ios-build:submit
pnpm native:visionos-build:submit
```

## Boundary Rules

- Linux CI must not call `xcodebuild`, `simctl`, or Apple signing tools.
- Signing identities, profiles, App Store Connect keys, provider secrets, and
  Apple account credentials must stay outside git.
- Build jobs must include repo ref, commit SHA, actor, reason, target scheme,
  destination, capability list, and returned artifact/log refs.
- A failed Mac job is a workflow failure, not a reason to bypass the Mac
  boundary locally.
