# Security Policy

Spatial Spray touches identity, location, UGC moderation and native Apple build workflow metadata. Please report security issues privately before opening a public issue.

## Reporting a vulnerability

Use GitHub private vulnerability reporting if it is enabled for this repository. If not, contact the repository owner privately.

Include:

- Affected API, workflow, package, service, script, native boundary, or moderation flow.
- Reproduction steps or a minimal proof of concept.
- Expected and observed behavior.
- Impact on user identity, sessions, location data, moderation controls, Mac Builder jobs, artifacts, logs, or device workflow.

Do not include:

- Raw provider credentials, Apple certificates, provisioning profiles, passwords, private keys, tokens, private user data, or sensitive locations.
- Private hostnames, account details, device identifiers, or production infrastructure diagrams.

## Security boundaries

- Production social login must verify provider tokens server-side before issuing sessions.
- Location and UGC data require privacy, moderation, blocking, reporting and takedown workflows before production launch.
- Native iOS/visionOS build, simulator, signing, archive, and App Store workflows require macOS, Xcode and appropriate Apple account setup.

