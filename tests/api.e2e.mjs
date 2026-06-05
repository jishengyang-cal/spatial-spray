import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 4311;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("node", ["services/api/dist/index.js"], {
  env: { ...process.env, PORT: String(port) },
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
  assert.equal(login.user.provider, "apple");

  const claimed = await post("/users/username", { username: "api_artist" }, login.token);
  assert.equal(claimed.user.username, "api_artist");

  const duplicateLogin = await post("/auth/dev-login", {
    provider: "google",
    providerSubject: "api-test-other",
    displayName: "Other User",
    devicePlatform: "web-simulator"
  });
  const duplicate = await postRaw("/users/username", { username: "api_artist" }, duplicateLogin.token);
  assert.equal(duplicate.status, 409);

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

  const created = await post("/sprays", sprayPayload, login.token);
  assert.equal(created.spray.title, "API wall piece");
  assert.equal(created.spray.username, "api_artist");

  const nearby = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500", login.token);
  assert.ok(nearby.sprays.some((spray) => spray.id === created.spray.id));
  assert.equal(typeof nearby.sprays.find((spray) => spray.id === created.spray.id).distanceMeters, "number");

  const report = await post(`/sprays/${created.spray.id}/reports`, { reason: "other", note: "test report" }, duplicateLogin.token);
  assert.equal(report.moderationStatus, "reported");

  const block = await post("/blocks", { blockedUserId: claimed.user.id }, duplicateLogin.token);
  assert.equal(block.blockedUserId, claimed.user.id);

  const hiddenNearby = await get("/sprays/nearby?lat=37.7749&lng=-122.4194&radiusMeters=500", duplicateLogin.token);
  assert.ok(!hiddenNearby.sprays.some((spray) => spray.id === created.spray.id));

  console.log("Spatial Spray API e2e passed.");
} finally {
  server.kill("SIGTERM");
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

async function get(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return response.json();
}

async function post(path, body, token) {
  const response = await postRaw(path, body, token);
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return response.json();
}

async function postRaw(path, body, token) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}
