import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const violations = [];

const requiredFiles = [
  "README.md",
  "docs/architecture.md",
  "docs/compliance.md",
  "docs/workflows/apple-development.md",
  "docs/workflows/mac-builder.md",
  "docs/privacy-policy.md",
  "docs/content-policy.md",
  "docs/app-store-review-notes.md",
  "workflows/spatial-spray.json",
  "packages/contracts/src/index.ts",
  "packages/brush-engine/src/index.ts",
  "services/api/src/index.ts",
  "apps/web-simulator/src/main.ts",
  "scripts/mac-builder-check.mjs",
  "scripts/mac-builder-mock.mjs",
  ".github/workflows/ci.yml",
  "native/apple/project.yml",
  "native/apple/README.md",
  "native/apple/SpatialSpray/Info.plist",
  "native/apple/SpatialSpray/Models/SprayBrushModel.swift",
  "native/apple/SpatialSpray/SpatialSprayApp.swift",
  "native/apple/SpatialSpray/Views/SprayARView.swift",
  "native/apple/SpatialSpray/Views/VisionSprayImmersiveView.swift"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    violations.push(`missing required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of [
  "build",
  "typecheck",
  "compliance:check",
  "workflow:check",
  "test:api",
  "test:e2e",
  "native:mac-builder:mock",
  "native:mac-builder:check",
  "native:ios-build:submit",
  "native:visionos-build:submit"
]) {
  if (!packageJson.scripts?.[script]) {
    violations.push(`missing package script: ${script}`);
  }
}

const trackedFiles = run("git ls-files --others --cached --exclude-standard")
  .split("\n")
  .filter(Boolean);
for (const file of trackedFiles.filter(isTextLike)) {
  const content = readFileSync(file, "utf8");
  if (/-----BEGIN (OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/.test(content)) {
    violations.push(`private key material found in ${file}`);
  }
  if (/(GOOGLE_CLIENT_SECRET|FACEBOOK_APP_SECRET|APPLE_PRIVATE_KEY|AWS_SECRET_ACCESS_KEY)\s*=/.test(content)) {
    violations.push(`secret-like assignment found in ${file}`);
  }
}

const contracts = readFileSync("packages/contracts/src/index.ts", "utf8");
for (const provider of ['"apple"', '"google"', '"facebook"']) {
  if (!contracts.includes(provider)) {
    violations.push(`auth provider missing from contracts: ${provider}`);
  }
}
if (!contracts.includes("ReportSprayRequest") || !contracts.includes("BlockUserRequest") || !contracts.includes("SetSprayVisibilityRequest")) {
  violations.push("contracts must include UGC report and block primitives");
}
if (!contracts.includes("SprayVisibility") || !contracts.includes("isSprayVisibility")) {
  violations.push("contracts must model public/private spray visibility");
}
for (const contract of ["MacBuildRequest", "MacBuildJob", "MacBuildArtifact", "WorkflowCapability", "AuditLogEntry"]) {
  if (!contracts.includes(contract)) {
    violations.push(`contracts missing workflow primitive: ${contract}`);
  }
}
if (!contracts.includes("AnchorProvider") || !contracts.includes("GeoPoint")) {
  violations.push("contracts must model location and anchor data");
}

const api = readFileSync("services/api/src/index.ts", "utf8");
if (!api.includes("/auth/dev-login") || !api.includes("/auth/provider-login") || !api.includes("/auth/refresh") || !api.includes("claimUsername")) {
  violations.push("API must expose dev/provider login, refresh, and unique username flow");
}
if (!api.includes("/sprays/nearby") || !api.includes("/sprays/clusters") || !api.includes("distanceMeters")) {
  violations.push("API must expose nearby spray discovery and map clusters");
}
if (!api.includes("reportSpray") || !api.includes("blockUser") || !api.includes("locationDenylist") || !api.includes("auditLog")) {
  violations.push("API must expose moderation report, block, denylist, and audit flows");
}
if (!api.includes("/visibility") || !api.includes("setSprayVisibility") || !api.includes("canDiscoverSpray")) {
  violations.push("API must enforce owner-controlled spray visibility in discovery and detail flows");
}
if (!api.includes("SPATIAL_SPRAY_DATA_FILE")) {
  violations.push("API must support configurable persistence path");
}
if (/CLIENT_SECRET|APP_SECRET|PRIVATE_KEY/.test(api)) {
  violations.push("API must not embed provider secrets");
}

const brushEngine = readFileSync("packages/brush-engine/src/index.ts", "utf8");
if (!brushEngine.includes("createDecalMeshFromStroke") || !brushEngine.includes("distanceAttenuatedRadius")) {
  violations.push("brush engine must include AR decal mesh and spray distance primitives");
}

const web = readFileSync("apps/web-simulator/src/main.ts", "utf8");
if (!web.includes("login-apple") || !web.includes("login-google") || !web.includes("login-facebook")) {
  violations.push("web simulator must expose Apple, Google, and Facebook login choices");
}
if (!web.includes("spray-canvas") || !web.includes("publishSpray") || !web.includes("/sprays/clusters") || !web.includes("adminHideSpray")) {
  violations.push("web simulator must include camera spray, map clusters, and moderation control flow");
}
if (!web.includes("visibility-select") || !web.includes("setSprayVisibility")) {
  violations.push("web simulator must expose public/private spray visibility controls");
}

const compliance = readFileSync("docs/compliance.md", "utf8");
for (const phrase of ["Report a spray piece", "Block a user", "Choose whether a spray piece is public or visible only to its owner", "Location Policy", "digital overlays only", "admin moderation queue"]) {
  if (!compliance.includes(phrase)) {
    violations.push(`compliance doc missing phrase: ${phrase}`);
  }
}

const appleReadme = readFileSync("native/apple/README.md", "utf8");
if (!appleReadme.includes("must not be committed")) {
  violations.push("native Apple README must preserve no-secret boundary");
}
const nativeBrush = readFileSync("native/apple/SpatialSpray/Models/SprayBrushModel.swift", "utf8");
if (!nativeBrush.includes("createDecalMesh") || !nativeBrush.includes("wallAbsorptionOpacity")) {
  violations.push("native Apple brush model must preserve decal and material primitives");
}

const workflow = JSON.parse(readFileSync("workflows/spatial-spray.json", "utf8"));
const phaseIds = new Set(workflow.phases.map((phase) => phase.id));
for (const id of ["contracts", "api", "web-simulator", "native-ios", "native-visionos", "mac-builder", "release-compliance", "ci"]) {
  if (!phaseIds.has(id)) {
    violations.push(`workflow missing phase: ${id}`);
  }
}

if (violations.length > 0) {
  console.error("Spatial Spray compliance check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Spatial Spray compliance check passed.");

function run(command) {
  const result = spawnSync("bash", ["-lc", command], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
  return result.stdout.trim();
}

function isTextLike(file) {
  return /\.(json|md|mjs|js|ts|tsx|css|html|ya?ml|plist|swift|gitignore)$/.test(file) || file === "README.md";
}
