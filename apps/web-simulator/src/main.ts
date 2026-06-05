import { createStroke, generateDrips, generateSprayParticles, nozzleProfile, type SprayRenderSettings } from "@spatial-spray/brush-engine";
import type {
  AuthProvider,
  CreateSprayPieceRequest,
  NearbySpraysResponse,
  NozzleType,
  SprayCluster,
  SprayClustersResponse,
  SprayPiece,
  SprayPoint,
  UserProfile
} from "@spatial-spray/contracts";
import "./styles.css";

const apiBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4301";
const currentLocation = { latitude: 37.7749, longitude: -122.4194, horizontalAccuracyMeters: 10 };
const colors = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#a855f7", "#f8fafc", "#111827"];

interface State {
  token: string | null;
  user: UserProfile | null;
  selectedColor: string;
  nozzle: NozzleType;
  nearby: SprayPiece[];
  clusters: SprayCluster[];
  selectedSprayId: string | null;
  currentPoints: SprayPoint[];
  strokes: ReturnType<typeof createStroke>[];
  mode: "map" | "camera";
  status: string;
}

const state: State = {
  token: localStorage.getItem("spatial-spray-token"),
  user: null,
  selectedColor: colors[0]!,
  nozzle: "soft-cap",
  nearby: [],
  clusters: [],
  selectedSprayId: null,
  currentPoints: [],
  strokes: [],
  mode: "map",
  status: ""
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("App root not found.");
}
const app: HTMLDivElement = root;

render();
void bootstrap();

async function bootstrap() {
  if (state.token) {
    try {
      const response = await api<{ user: UserProfile }>("/me");
      state.user = response.user;
    } catch {
      state.token = null;
      localStorage.removeItem("spatial-spray-token");
    }
  }
  await loadNearby();
  render();
}

function render() {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand"><span class="mark"></span><span>Spatial Spray</span></div>
        <div class="muted" data-testid="active-user">${state.user?.username ?? state.user?.displayName ?? "Signed out"}</div>
      </header>
      <main class="main">
        <aside class="panel">${renderLeftPanel()}</aside>
        <section class="workspace">${state.mode === "map" ? renderMap() : renderCamera()}</section>
        <aside class="panel right">${renderRightPanel()}</aside>
      </main>
    </div>
  `;

  bindEvents();
  if (state.mode === "camera") {
    setupCanvas();
  }
}

function renderLeftPanel() {
  return `
    <div class="section">
      <h2>Account</h2>
      ${state.user ? renderUserPanel() : renderLoginPanel()}
    </div>
    <div class="section">
      <h2>Mode</h2>
      <div class="stack">
        <button class="${state.mode === "map" ? "primary" : ""}" data-action="mode-map" data-testid="map-mode">Map mode</button>
        <button class="${state.mode === "camera" ? "primary" : ""}" data-action="mode-camera" data-testid="camera-mode">Camera spray</button>
      </div>
    </div>
    <div class="section">
      <h2>Location</h2>
      <div class="muted">lat ${currentLocation.latitude.toFixed(4)}, lng ${currentLocation.longitude.toFixed(4)}</div>
      <button data-action="refresh-nearby">Refresh nearby</button>
    </div>
  `;
}

function renderLoginPanel() {
  return `
    <div class="stack">
      <button data-provider="apple" data-testid="login-apple">Continue with Apple</button>
      <button data-provider="google" data-testid="login-google">Continue with Google</button>
      <button data-provider="facebook" data-testid="login-facebook">Continue with Facebook</button>
    </div>
  `;
}

function renderUserPanel() {
  if (!state.user?.username) {
    return `
      <form class="stack" data-action="claim-username">
        <input name="username" placeholder="unique_username" value="sprayer_${Math.floor(Math.random() * 1000)}" data-testid="username-input" />
        <button class="primary" data-testid="claim-username">Create username</button>
      </form>
    `;
  }

  return `
    <div class="stack">
      <div class="spray-card">
        <div class="spray-title">@${state.user.username}</div>
        <div class="muted">${state.user.provider} account</div>
      </div>
      <button data-action="sign-out">Sign out</button>
    </div>
  `;
}

function renderMap() {
  const clusters = state.clusters
    .map((cluster, index) => {
      const left = 50 + Math.sin(index * 1.7) * Math.min(42, 8 + cluster.distanceMeters / 18);
      const top = 50 + Math.cos(index * 1.4) * Math.min(38, 8 + cluster.distanceMeters / 20);
      return `<button class="cluster-pin" style="left:${left}%;top:${top}%;" title="${cluster.count} sprays nearby">${cluster.count}</button>`;
    })
    .join("");
  const pins = state.nearby
    .map((spray, index) => {
      const left = 50 + Math.sin(index * 2.2) * Math.min(38, 10 + (spray.distanceMeters ?? 80) / 12);
      const top = 50 + Math.cos(index * 1.8) * Math.min(35, 9 + (spray.distanceMeters ?? 80) / 14);
      return `<button class="spray-pin ${state.selectedSprayId === spray.id ? "active" : ""}" data-select="${spray.id}" title="${spray.title}" style="left:${left}%;top:${top}%;background:${spray.strokes[0]?.color ?? "#f97316"}"></button>`;
    })
    .join("");

  return `<div class="map" data-testid="map"><div class="location-dot"></div>${clusters}${pins}</div>`;
}

function renderCamera() {
  return `<canvas class="spray-canvas" width="1200" height="760" data-testid="spray-canvas"></canvas>`;
}

function renderRightPanel() {
  return `
    <div class="section">
      <h2>Spray</h2>
      <div class="stack">
        <div class="swatches">
          ${colors.map((color) => `<button class="swatch ${color === state.selectedColor ? "active" : ""}" data-color="${color}" style="background:${color}" aria-label="${color}"></button>`).join("")}
        </div>
        <select data-action="nozzle" data-testid="nozzle-select">
          ${(["soft-cap", "fat-cap", "skinny-cap", "drip"] as NozzleType[]).map((nozzle) => `<option value="${nozzle}" ${nozzle === state.nozzle ? "selected" : ""}>${nozzle}</option>`).join("")}
        </select>
        <button class="primary" data-action="publish" data-testid="publish-spray">Publish current spray</button>
        <button data-action="clear-canvas">Clear canvas</button>
      </div>
    </div>
    <div class="section">
      <h2>Nearby</h2>
      <div class="stack" data-testid="nearby-list">
        ${state.nearby.map(renderSprayCard).join("") || `<div class="muted">No public spray nearby</div>`}
      </div>
    </div>
    ${renderSelectedSpray()}
    <div class="status" data-testid="status">${state.status}</div>
  `;
}

function renderSprayCard(spray: SprayPiece) {
  return `
    <div class="spray-card">
      <div class="spray-title">${escapeHtml(spray.title)}</div>
      <div class="muted">@${spray.username} · ${spray.distanceMeters ?? 0}m · ${spray.moderationStatus}</div>
      <button data-select="${spray.id}">Details</button>
      <button class="danger" data-report="${spray.id}">Report</button>
    </div>
  `;
}

function renderSelectedSpray() {
  const spray = state.nearby.find((entry) => entry.id === state.selectedSprayId);
  if (!spray) {
    return "";
  }

  const ownSpray = state.user?.id === spray.ownerUserId;
  return `
    <div class="section">
      <h2>Selected</h2>
      <div class="spray-card" data-testid="selected-spray">
        <div class="spray-title">${escapeHtml(spray.title)}</div>
        <div class="muted">@${spray.username} · ${spray.distanceMeters ?? 0}m</div>
        <div class="muted">anchor: ${spray.anchor.provider} · strokes: ${spray.strokes.length}</div>
        <div class="stack">
          <button data-block="${spray.ownerUserId}">Block artist</button>
          ${ownSpray ? `<button class="danger" data-delete="${spray.id}">Delete my spray</button>` : ""}
          <button class="danger" data-admin-hide="${spray.id}">Admin hide</button>
        </div>
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>("[data-provider]").forEach((button) => {
    button.addEventListener("click", () => void login(button.dataset.provider as AuthProvider));
  });

  document.querySelector<HTMLFormElement>("[data-action='claim-username']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void claimUsername(String(data.get("username") ?? ""));
  });

  document.querySelector<HTMLButtonElement>("[data-action='mode-map']")?.addEventListener("click", () => {
    state.mode = "map";
    render();
  });
  document.querySelector<HTMLButtonElement>("[data-action='mode-camera']")?.addEventListener("click", () => {
    state.mode = "camera";
    render();
  });
  document.querySelector<HTMLButtonElement>("[data-action='refresh-nearby']")?.addEventListener("click", () => void refreshNearby());
  document.querySelector<HTMLButtonElement>("[data-action='sign-out']")?.addEventListener("click", () => {
    state.token = null;
    state.user = null;
    localStorage.removeItem("spatial-spray-token");
    render();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedColor = button.dataset.color ?? state.selectedColor;
      render();
    });
  });
  document.querySelector<HTMLSelectElement>("[data-action='nozzle']")?.addEventListener("change", (event) => {
    state.nozzle = (event.currentTarget as HTMLSelectElement).value as NozzleType;
  });
  document.querySelector<HTMLButtonElement>("[data-action='publish']")?.addEventListener("click", () => void publishSpray());
  document.querySelector<HTMLButtonElement>("[data-action='clear-canvas']")?.addEventListener("click", () => {
    state.strokes = [];
    state.currentPoints = [];
    state.mode = "camera";
    render();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-report]").forEach((button) => {
    button.addEventListener("click", () => void reportSpray(button.dataset.report ?? ""));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSprayId = button.dataset.select ?? null;
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => void deleteSpray(button.dataset.delete ?? ""));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-block]").forEach((button) => {
    button.addEventListener("click", () => void blockArtist(button.dataset.block ?? ""));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-admin-hide]").forEach((button) => {
    button.addEventListener("click", () => void adminHideSpray(button.dataset.adminHide ?? ""));
  });
}

function setupCanvas() {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='spray-canvas']");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  redrawCanvas(ctx, canvas);

  let spraying = false;
  let seed = 1;
  canvas.addEventListener("pointerdown", (event) => {
    spraying = true;
    state.currentPoints = [];
    canvas.setPointerCapture(event.pointerId);
    paint(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (spraying) paint(event);
  });
  canvas.addEventListener("pointerup", (event) => {
    spraying = false;
    canvas.releasePointerCapture(event.pointerId);
    if (state.currentPoints.length > 0) {
      state.strokes.push(createStroke(randomId(), state.selectedColor, state.nozzle, state.currentPoints));
      state.currentPoints = [];
    }
  });

  function paint(event: PointerEvent) {
    const rect = canvas!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas!.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas!.height;
    const profile = nozzleProfile(state.nozzle);
    const pressure = event.pressure || 0.65;
    const settings: SprayRenderSettings = {
      color: state.selectedColor,
      radiusPixels: profile.radiusMeters * 900,
      opacity: profile.opacity,
      nozzle: state.nozzle,
      overspray: profile.overspray,
      drip: profile.drip
    };

    state.currentPoints.push({
      x: x / canvas!.width,
      y: y / canvas!.height,
      z: 0,
      pressure,
      timestampMs: Date.now()
    });
    drawSpray(ctx!, x, y, pressure, settings, seed++);
  }
}

function redrawCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#58616a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  for (const stroke of state.strokes) {
    const settings: SprayRenderSettings = {
      color: stroke.color,
      radiusPixels: stroke.radiusMeters * 900,
      opacity: stroke.opacity,
      nozzle: stroke.nozzle,
      overspray: stroke.overspray,
      drip: stroke.drip
    };
    stroke.points.forEach((point, index) => drawSpray(ctx, point.x * canvas.width, point.y * canvas.height, point.pressure, settings, index + 1));
  }
}

function drawSpray(ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number, settings: SprayRenderSettings, seed: number) {
  ctx.fillStyle = settings.color;
  for (const particle of generateSprayParticles(x, y, pressure, settings, seed)) {
    ctx.globalAlpha = particle.alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const drip of generateDrips(x, y, settings, seed)) {
    ctx.globalAlpha = drip.alpha;
    ctx.fillRect(drip.x - drip.radius / 2, y, drip.radius, drip.y - y);
  }
  ctx.globalAlpha = 1;
}

async function login(provider: AuthProvider) {
  const response = await api<{ token: string; user: UserProfile }>("/auth/dev-login", {
    method: "POST",
    body: {
      provider,
      providerSubject: `${provider}-local-user`,
      displayName: `${provider} user`,
      devicePlatform: "web-simulator"
    }
  });
  state.token = response.token;
  state.user = response.user;
  localStorage.setItem("spatial-spray-token", response.token);
  state.status = "Signed in";
  render();
}

async function claimUsername(username: string) {
  const response = await api<{ user: UserProfile }>("/users/username", {
    method: "POST",
    body: { username }
  });
  state.user = response.user;
  state.status = `Username @${response.user.username} created`;
  render();
}

async function loadNearby() {
  const response = await api<NearbySpraysResponse>(`/sprays/nearby?lat=${currentLocation.latitude}&lng=${currentLocation.longitude}&radiusMeters=1200`);
  state.nearby = response.sprays;
  const clusters = await api<SprayClustersResponse>(`/sprays/clusters?lat=${currentLocation.latitude}&lng=${currentLocation.longitude}&radiusMeters=1200&cellMeters=180`);
  state.clusters = clusters.clusters;
}

async function refreshNearby() {
  await loadNearby();
  state.status = "Nearby map refreshed";
  render();
}

async function publishSpray() {
  if (!state.user?.username) {
    state.status = "Create a username first";
    render();
    return;
  }
  if (state.strokes.length === 0 && state.currentPoints.length === 0) {
    state.status = "Draw on the camera surface first";
    render();
    return;
  }
  const payload: CreateSprayPieceRequest = {
    title: `Spray by @${state.user.username}`,
    geo: currentLocation,
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
    strokes: state.currentPoints.length > 0
      ? [...state.strokes, createStroke(randomId(), state.selectedColor, state.nozzle, state.currentPoints)]
      : state.strokes
  };

  await api("/sprays", { method: "POST", body: payload });
  state.currentPoints = [];
  state.strokes = [];
  state.status = "Spray published nearby";
  await loadNearby();
  state.selectedSprayId = state.nearby[0]?.id ?? null;
  state.mode = "map";
  render();
}

async function reportSpray(id: string) {
  await api(`/sprays/${id}/reports`, { method: "POST", body: { reason: "other", note: "web simulator report" } });
  state.status = "Report submitted";
  await loadNearby();
  render();
}

async function deleteSpray(id: string) {
  await api(`/sprays/${id}`, { method: "DELETE" });
  state.selectedSprayId = null;
  state.status = "Spray removed";
  await loadNearby();
  render();
}

async function blockArtist(blockedUserId: string) {
  await api("/blocks", { method: "POST", body: { blockedUserId } });
  state.selectedSprayId = null;
  state.status = "Artist blocked";
  await loadNearby();
  render();
}

async function adminHideSpray(id: string) {
  await api(`/moderation/sprays/${id}/status`, {
    method: "POST",
    body: { action: "hide", note: "web simulator admin hide" },
    admin: true
  });
  state.selectedSprayId = null;
  state.status = "Admin hide applied";
  await loadNearby();
  render();
}

async function api<T>(path: string, options: { method?: string; body?: unknown; admin?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) headers["content-type"] = "application/json";
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  if (options.admin) headers["x-admin-token"] = "local-admin";
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char] ?? char);
}
