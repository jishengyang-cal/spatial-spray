import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const port = 4311;
const baseUrl = `http://127.0.0.1:${port}`;
const dataFile = `.run/test-api-${Date.now()}.json`;
rmSync(dataFile, { force: true });
const server = spawn("node", ["services/api/dist/index.js"], {
  env: { ...process.env, PORT: String(port), SPATIAL_SPRAY_DATA_FILE: dataFile },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth();

  const login = await post("/auth/dev-login", {
    provider: "apple",
    providerSubject: "api-test-user",
    displayName: "API Test User",
    devicePlatform: "web-simulator"
  });
  assert.ok(login.token);
  assert.ok(login.refreshToken);
  assert.equal(login.user.provider, "apple");

  const refresh = await post("/auth/refresh", { refreshToken: login.refreshToken });
  assert.ok(refresh.token);
  const activeToken = refresh.token;

  const claimed = await post("/users/username", { username: "api_artist" }, activeToken);
  assert.equal(claimed.user.username, "api_artist");

  const duplicateLogin = await post("/auth/dev-login", {
    provider: "google",
    providerSubject: "api-test-other",
    displayName: "Other User",
    devicePlatform: "web-simulator"
  });
  const providerLogin = await postRaw("/auth/provider-login", {
    provider: "apple",
    idToken: "stub-token",
    devicePlatform: "web-simulator"
  });
  assert.equal(providerLogin.status, 501);

  const duplicate = await postRaw("/users/username", { username: "api_artist" }, duplicateLogin.token);
  assert.equal(duplicate.status, 409);
  const viewerClaimed = await post("/users/username", { username: "api_viewer" }, duplicateLogin.token);
  assert.equal(viewerClaimed.user.username, "api_viewer");

  const sprayPayload = {
    title: "API wall piece",
    geo: { latitude: 37.775, longitude: -122.4195, horizontalAccuracyMeters: 8 },
    visibility: "public",
    anchor: {
      provider: "manual-local",
      surfacePose: {
        position: [0, 1.4, -1.2],
        normal: [0, 0, 1],
        yawDegrees: 0,
        pitchDegrees: 0,
        rollDegrees: 0
      }
    },
    strokes: [
      {
        id: "stroke-1",
        color: "#ef4444",
        radiusMeters: 0.04,
        opacity: 0.7,
        nozzle: "soft-cap",
        overspray: 0.5,
        drip: 0.1,
        points: [{ x: 0.5, y: 0.5, z: 0, pressure: 0.8, timestampMs: Date.now() }]
      }
    ]
  };

  const created = await post("/sprays", sprayPayload, activeToken);
  assert.equal(created.spray.title, "API wall piece");
  assert.equal(created.spray.username, "api_artist");

  const privateCreated = await post("/sprays", { ...sprayPayload, title: "Private office piece", visibility: "private" }, activeToken);
  assert.equal(privateCreated.spray.visibility, "private");

  const invalidVisibility = await postRaw("/sprays", { ...sprayPayload, title: "Invalid visibility piece", visibility: "friends" }, activeToken);
  assert.equal(invalidVisibility.status, 400);

  const nearby = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500", activeToken);
  assert.ok(nearby.sprays.some((spray) => spray.id === created.spray.id));
  assert.ok(nearby.sprays.some((spray) => spray.id === privateCreated.spray.id));
  assert.equal(typeof nearby.sprays.find((spray) => spray.id === created.spray.id).distanceMeters, "number");

  const anonymousNearby = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500");
  assert.ok(anonymousNearby.sprays.some((spray) => spray.id === created.spray.id));
  assert.ok(!anonymousNearby.sprays.some((spray) => spray.id === privateCreated.spray.id));

  const otherNearbyBeforePublic = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500", duplicateLogin.token);
  assert.ok(otherNearbyBeforePublic.sprays.some((spray) => spray.id === created.spray.id));
  assert.ok(!otherNearbyBeforePublic.sprays.some((spray) => spray.id === privateCreated.spray.id));

  const ownerDirectPrivate = await get(`/sprays/${privateCreated.spray.id}`, activeToken);
  assert.equal(ownerDirectPrivate.spray.id, privateCreated.spray.id);
  const anonymousDirectPrivate = await getRaw(`/sprays/${privateCreated.spray.id}`);
  assert.equal(anonymousDirectPrivate.status, 404);
  const otherDirectPrivate = await getRaw(`/sprays/${privateCreated.spray.id}`, duplicateLogin.token);
  assert.equal(otherDirectPrivate.status, 404);

  const clusters = await get("/sprays/clusters?lat=37.7749&lng=-122.4194&radiusMeters=500&cellMeters=150", activeToken);
  assert.ok(clusters.clusters.length >= 1);
  assert.ok(clusters.clusters.some((cluster) => cluster.sampleSprayIds.includes(created.spray.id)));
  assert.ok(clusters.clusters.some((cluster) => cluster.sampleSprayIds.includes(privateCreated.spray.id)));

  const otherClustersBeforePublic = await get("/sprays/clusters?lat=37.7749&lng=-122.4194&radiusMeters=500&cellMeters=150", duplicateLogin.token);
  assert.ok(!otherClustersBeforePublic.clusters.some((cluster) => cluster.sampleSprayIds.includes(privateCreated.spray.id)));

  const unauthorizedVisibility = await postRaw(`/sprays/${privateCreated.spray.id}/visibility`, { visibility: "public" }, duplicateLogin.token);
  assert.equal(unauthorizedVisibility.status, 403);

  const publicized = await post(`/sprays/${privateCreated.spray.id}/visibility`, { visibility: "public" }, activeToken);
  assert.equal(publicized.spray.visibility, "public");

  const otherNearbyAfterPublic = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500", duplicateLogin.token);
  assert.ok(otherNearbyAfterPublic.sprays.some((spray) => spray.id === privateCreated.spray.id));

  const report = await post(`/sprays/${created.spray.id}/reports`, { reason: "other", note: "test report" }, duplicateLogin.token);
  assert.equal(report.moderationStatus, "reported");

  const reports = await get("/moderation/reports", undefined, { "x-admin-token": "local-admin" });
  assert.ok(reports.reports.some((entry) => entry.sprayId === created.spray.id));

  const hidden = await post(
    `/moderation/sprays/${created.spray.id}/status`,
    { action: "hide", note: "admin test" },
    undefined,
    { "x-admin-token": "local-admin" }
  );
  assert.equal(hidden.spray.moderationStatus, "hidden");

  const visible = await post(
    `/moderation/sprays/${created.spray.id}/status`,
    { action: "mark-visible", note: "admin test reset" },
    undefined,
    { "x-admin-token": "local-admin" }
  );
  assert.equal(visible.spray.moderationStatus, "visible");

  const audit = await get("/moderation/audit", undefined, { "x-admin-token": "local-admin" });
  assert.ok(audit.auditLog.some((entry) => entry.action === "moderation.spray-status"));

  const deny = await post(
    "/moderation/location-denylist",
    {
      name: "API test sensitive location",
      center: { latitude: 37.775, longitude: -122.4195 },
      radiusMeters: 40,
      reason: "automated compliance test"
    },
    undefined,
    { "x-admin-token": "local-admin" }
  );
  assert.ok(deny.entry.id);

  const deniedSpray = await postRaw("/sprays", { ...sprayPayload, title: "Denied wall piece" }, activeToken);
  assert.equal(deniedSpray.status, 403);

  const block = await post("/blocks", { blockedUserId: claimed.user.id }, duplicateLogin.token);
  assert.equal(block.blockedUserId, claimed.user.id);

  const hiddenNearby = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500", duplicateLogin.token);
  assert.ok(!hiddenNearby.sprays.some((spray) => spray.id === created.spray.id));

  console.log("Spatial Spray API e2e passed.");
} finally {
  server.kill("SIGTERM");
  rmSync(dataFile, { force: true });
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API did not become healthy.");
}

async function get(path, token, extraHeaders = {}) {
  const response = await getRaw(path, token, extraHeaders);
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return response.json();
}

async function getRaw(path, token, extraHeaders = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders }
  });
}

async function post(path, body, token, extraHeaders = {}) {
  const response = await postRaw(path, body, token, extraHeaders);
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return response.json();
}

async function postRaw(path, body, token, extraHeaders = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
}
