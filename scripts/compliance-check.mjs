import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const violations = [];

const requiredFiles = [
  "README.md",
  "docs/architecture.md",
  "docs/compliance.md",
  "docs/workflows/apple-development.md",
  "workflows/spatial-spray.json",
  "packages/contracts/src/index.ts",
  "packages/brush-engine/src/index.ts",
  "services/api/src/index.ts",
  "apps/web-simulator/src/main.ts",
  "native/apple/project.yml",
  "native/apple/README.md",
  "native/apple/SpatialSpray/Info.plist",
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
for (const script of ["build", "typecheck", "compliance:check", "workflow:check", "test:api", "test:e2e"]) {
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
if (!contracts.includes("ReportSprayRequest") || !contracts.includes("BlockUserRequest")) {
  violations.push("contracts must include UGC report and block primitives");
}
if (!contracts.includes("AnchorProvider") || !contracts.includes("GeoPoint")) {
  violations.push("contracts must model location and anchor data");
}

const api = readFileSync("services/api/src/index.ts", "utf8");
if (!api.includes("/auth/dev-login") || !api.includes("claimUsername")) {
  violations.push("API must expose dev login and unique username flow");
}
if (!api.includes("/sprays/nearby") || !api.includes("distanceMeters")) {
  violations.push("API must expose nearby spray discovery");
}
if (!api.includes("reportSpray") || !api.includes("blockUser")) {
  violations.push("API must expose moderation report and block flows");
}
if (/CLIENT_SECRET|APP_SECRET|PRIVATE_KEY/.test(api)) {
  violations.push("API must not embed provider secrets");
}

const web = readFileSync("apps/web-simulator/src/main.ts", "utf8");
if (!web.includes("login-apple") || !web.includes("login-google") || !web.includes("login-facebook")) {
  violations.push("web simulator must expose Apple, Google, and Facebook login choices");
}
if (!web.includes("spray-canvas") || !web.includes("publishSpray")) {
  violations.push("web simulator must include camera spray creation flow");
}

const compliance = readFileSync("docs/compliance.md", "utf8");
for (const phrase of ["Report a spray piece", "Block a user", "Location Policy", "digital overlays only"]) {
  if (!compliance.includes(phrase)) {
    violations.push(`compliance doc missing phrase: ${phrase}`);
  }
}

const appleReadme = readFileSync("native/apple/README.md", "utf8");
if (!appleReadme.includes("must not be committed")) {
  violations.push("native Apple README must preserve no-secret boundary");
}

const workflow = JSON.parse(readFileSync("workflows/spatial-spray.json", "utf8"));
const phaseIds = new Set(workflow.phases.map((phase) => phase.id));
for (const id of ["contracts", "api", "web-simulator", "native-ios", "native-visionos", "release-compliance"]) {
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

