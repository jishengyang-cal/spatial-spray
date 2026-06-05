import { execFileSync } from "node:child_process";

const command = process.argv[2] ?? "check";
const builderUrl = process.env.SPATIAL_SPRAY_MAC_BUILDER_URL?.replace(/\/$/, "");
const token = process.env.SPATIAL_SPRAY_MAC_BUILDER_TOKEN;

switch (command) {
  case "check":
    await check();
    break;
  case "ios-build":
    await submit("ios-build");
    break;
  case "visionos-build":
    await submit("visionos-build");
    break;
  case "help":
  default:
    printHelp();
    process.exit(command === "help" ? 0 : 1);
}

async function check() {
  if (!builderUrl) {
    console.log("Spatial Spray Mac Builder capability");
    console.log("available: false");
    console.log("reason: set SPATIAL_SPRAY_MAC_BUILDER_URL to submit native build jobs");
    return;
  }

  const response = await fetch(`${builderUrl}/health`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Mac Builder health check failed: ${response.status}`);
  }
  const payload = await response.json();
  console.log("Spatial Spray Mac Builder capability");
  console.log(`available: true`);
  console.log(`url: ${builderUrl}`);
  console.log(`mode: ${payload.mode ?? "unknown"}`);
  console.log(`capabilities: ${(payload.capabilities ?? []).join(", ")}`);
}

async function submit(kind) {
  if (!builderUrl) {
    throw new Error("Set SPATIAL_SPRAY_MAC_BUILDER_URL before submitting native build jobs.");
  }

  const request = buildRequest(kind);
  const response = await fetch(`${builderUrl}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Mac Builder job submission failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  const finalPayload = payload.job?.id ? await pollJob(payload.job.id) : payload;
  console.log(JSON.stringify(finalPayload, null, 2));
}

function buildRequest(kind) {
  const commitSha = git(["rev-parse", "HEAD"]);
  const branch = git(["branch", "--show-current"]) || "main";
  const remoteUrl = git(["remote", "get-url", "origin"]);
  const isVision = kind.startsWith("visionos");

  return {
    kind,
    repoRef: {
      provider: "github",
      repository: "jishengyang-cal/spatial-spray",
      remoteUrl,
      branch,
      commitSha
    },
    project: {
      sourceRoot: "native/apple",
      generator: "xcodegen",
      generatorSpecPath: "native/apple/project.yml",
      projectPath: "native/apple/SpatialSpray.xcodeproj"
    },
    target: {
      scheme: isVision ? "SpatialSprayVision" : "SpatialSprayiOS",
      configuration: "Debug",
      destination: isVision ? "platform=visionOS Simulator,name=Apple Vision Pro" : "platform=iOS Simulator,name=iPhone 16 Pro",
      sdk: isVision ? "xrsimulator" : "iphonesimulator"
    },
    capabilities: ["mac-builder-required", "mcp-candidate"],
    reason: `Spatial Spray ${kind}`,
    actorId: process.env.USER ?? "local-user"
  };
}

function authHeaders() {
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function pollJob(jobId) {
  const deadline = Date.now() + Number(process.env.SPATIAL_SPRAY_MAC_BUILDER_TIMEOUT_MS ?? 120_000);
  let latest = null;
  while (Date.now() < deadline) {
    const response = await fetch(`${builderUrl}/jobs/${jobId}`, { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Mac Builder job poll failed: ${response.status} ${await response.text()}`);
    }
    latest = await response.json();
    const status = latest.job?.status;
    if (["succeeded", "failed", "cancelled"].includes(status)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {
    ...latest,
    warning: `Job ${jobId} did not finish before timeout.`
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function printHelp() {
  console.log("Usage: node scripts/mac-builder-check.mjs <command>");
  console.log("");
  console.log("Commands:");
  console.log("  check           Check Mac Builder capability.");
  console.log("  ios-build       Submit iOS simulator build request.");
  console.log("  visionos-build  Submit visionOS simulator build request.");
}
