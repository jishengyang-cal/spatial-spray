import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import {
  assertGeoPoint,
  distanceMeters,
  isAuthProvider,
  normalizeUsername,
  simpleGeoHash,
  validateUsername,
  type AdminModerationAction,
  type AuditLogEntry,
  type AuthProvider,
  type AuthRequest,
  type AuthResponse,
  type BlockUserRequest,
  type BlockUserResponse,
  type ClaimUsernameRequest,
  type ClaimUsernameResponse,
  type CreateLocationDenylistEntryRequest,
  type CreateLocationDenylistEntryResponse,
  type CreateSprayPieceRequest,
  type CreateSprayPieceResponse,
  type LocationDenylistEntry,
  type ModerationReport,
  type NearbySpraysResponse,
  type ProviderLoginRequest,
  type RefreshSessionRequest,
  type RefreshSessionResponse,
  type ReportSprayRequest,
  type ReportSprayResponse,
  type SetModerationStatusRequest,
  type SetModerationStatusResponse,
  type SprayCluster,
  type SprayClustersResponse,
  type SprayPiece,
  type SprayReportReason,
  type UserProfile
} from "@spatial-spray/contracts";

interface StoredSession {
  token: string;
  refreshToken: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface BlockRelation {
  userId: string;
  blockedUserId: string;
  createdAt: string;
}

interface AppState {
  users: UserProfile[];
  sessions: StoredSession[];
  sprays: SprayPiece[];
  reports: ModerationReport[];
  blocks: BlockRelation[];
  locationDenylist: LocationDenylistEntry[];
  auditLog: AuditLogEntry[];
}

const port = Number(process.env.PORT ?? 4301);
const dataPath = resolve(process.env.SPATIAL_SPRAY_DATA_FILE ?? ".run/spatial-spray/api-state.json");
const adminToken = process.env.ADMIN_TOKEN ?? "local-admin";
const reportReasons = new Set<SprayReportReason>(["illegal", "hate", "sexual", "harassment", "private-property", "spam", "other"]);
const moderationActions = new Set<AdminModerationAction>(["mark-visible", "hide", "remove"]);
const state = loadState();

const server = createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    await route(request, response);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    sendJson(response, statusCode, {
      error: error instanceof Error ? error.message : "Unexpected API error"
    });
  }
});

server.listen(port, () => {
  console.log(`spatial-spray API listening on http://127.0.0.1:${port}`);
  console.log(`spatial-spray API data file: ${dataPath}`);
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "spatial-spray-api",
      persistent: true,
      dataPath
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/dev-login") {
    const body = await readJson<AuthRequest>(request);
    sendJson(response, 201, devLogin(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/provider-login") {
    const body = await readJson<ProviderLoginRequest>(request);
    sendJson(response, 201, providerLogin(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/refresh") {
    const body = await readJson<RefreshSessionRequest>(request);
    sendJson(response, 200, refreshSession(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    const session = requireSession(request);
    state.sessions = state.sessions.filter((entry) => entry.token !== session.token);
    audit("auth.logout", "auth", session.userId, session.userId);
    persist();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/me") {
    sendJson(response, 200, { user: requireUser(request) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/users/username") {
    const user = requireUser(request);
    const body = await readJson<ClaimUsernameRequest>(request);
    const payload: ClaimUsernameResponse = { user: claimUsername(user, body.username) };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/sprays/nearby") {
    const user = optionalUser(request);
    const center = readCenter(url);
    const radiusMeters = Math.min(requiredNumber(url.searchParams.get("radiusMeters") ?? "1000", "radiusMeters"), 5000);
    const payload: NearbySpraysResponse = { sprays: nearbySprays(center, radiusMeters, user) };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/sprays/clusters") {
    const user = optionalUser(request);
    const center = readCenter(url);
    const radiusMeters = Math.min(requiredNumber(url.searchParams.get("radiusMeters") ?? "1000", "radiusMeters"), 5000);
    const cellMeters = Math.max(50, Math.min(requiredNumber(url.searchParams.get("cellMeters") ?? "250", "cellMeters"), 1000));
    const payload: SprayClustersResponse = { clusters: sprayClusters(center, radiusMeters, cellMeters, user) };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/sprays") {
    const user = requireUser(request);
    const body = await readJson<CreateSprayPieceRequest>(request);
    const payload: CreateSprayPieceResponse = { spray: createSpray(user, body) };
    sendJson(response, 201, payload);
    return;
  }

  const sprayMatch = /^\/sprays\/([^/]+)$/.exec(url.pathname);
  if (sprayMatch && request.method === "GET") {
    const spray = findVisibleSpray(sprayMatch[1] ?? "");
    sendJson(response, 200, { spray });
    return;
  }

  if (sprayMatch && request.method === "DELETE") {
    const user = requireUser(request);
    const spray = findSpray(sprayMatch[1] ?? "");
    if (spray.ownerUserId !== user.id) {
      throw new HttpError(403, "Only the owner can delete this spray.");
    }
    spray.moderationStatus = "removed";
    spray.updatedAt = new Date().toISOString();
    audit("spray.owner-remove", "spray", spray.id, user.id);
    persist();
    sendJson(response, 200, { spray });
    return;
  }

  const reportMatch = /^\/sprays\/([^/]+)\/reports$/.exec(url.pathname);
  if (request.method === "POST" && reportMatch) {
    const user = requireUser(request);
    const body = await readJson<ReportSprayRequest>(request);
    const payload: ReportSprayResponse = reportSpray(user, reportMatch[1] ?? "", body);
    sendJson(response, 201, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/blocks") {
    const user = requireUser(request);
    const body = await readJson<BlockUserRequest>(request);
    const payload: BlockUserResponse = blockUser(user, body);
    sendJson(response, 201, payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/blocks") {
    const user = requireUser(request);
    sendJson(response, 200, { blocks: state.blocks.filter((block) => block.userId === user.id) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/moderation/reports") {
    requireAdmin(request);
    sendJson(response, 200, { reports: state.reports });
    return;
  }

  if (request.method === "GET" && url.pathname === "/moderation/audit") {
    requireAdmin(request);
    sendJson(response, 200, { auditLog: state.auditLog.slice(-500).reverse() });
    return;
  }

  const moderationSprayMatch = /^\/moderation\/sprays\/([^/]+)\/status$/.exec(url.pathname);
  if (request.method === "POST" && moderationSprayMatch) {
    requireAdmin(request);
    const body = await readJson<SetModerationStatusRequest>(request);
    const payload: SetModerationStatusResponse = setModerationStatus(moderationSprayMatch[1] ?? "", body.action, body.note);
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/moderation/location-denylist") {
    requireAdmin(request);
    sendJson(response, 200, { entries: state.locationDenylist });
    return;
  }

  if (request.method === "POST" && url.pathname === "/moderation/location-denylist") {
    requireAdmin(request);
    const body = await readJson<CreateLocationDenylistEntryRequest>(request);
    const payload: CreateLocationDenylistEntryResponse = { entry: createLocationDenylistEntry(body) };
    sendJson(response, 201, payload);
    return;
  }

  const denyMatch = /^\/moderation\/location-denylist\/([^/]+)$/.exec(url.pathname);
  if (request.method === "DELETE" && denyMatch) {
    requireAdmin(request);
    state.locationDenylist = state.locationDenylist.filter((entry) => entry.id !== denyMatch[1]);
    audit("location-denylist.delete", "location", denyMatch[1]);
    persist();
    sendJson(response, 200, { ok: true });
    return;
  }

  throw new HttpError(404, "Not found.");
}

function devLogin(request: AuthRequest): AuthResponse {
  const verified = verifyDevProvider(request.provider, request.providerSubject, request.displayName);
  return loginVerifiedUser(verified.provider, verified.providerSubject, verified.displayName, "auth.dev-login");
}

function providerLogin(request: ProviderLoginRequest): AuthResponse {
  const verified = verifyProviderToken(request);
  return loginVerifiedUser(verified.provider, verified.providerSubject, verified.displayName, "auth.provider-login");
}

function refreshSession(request: RefreshSessionRequest): RefreshSessionResponse {
  const existing = state.sessions.find((session) => session.refreshToken === request.refreshToken);
  if (!existing) {
    throw new HttpError(401, "Refresh token is invalid.");
  }
  const user = getUser(existing.userId);
  state.sessions = state.sessions.filter((session) => session.refreshToken !== request.refreshToken);
  const session = createSession(user);
  audit("auth.refresh", "auth", user.id, user.id);
  persist();
  return { token: session.token, refreshToken: session.refreshToken };
}

function loginVerifiedUser(
  provider: AuthProvider,
  providerSubject: string,
  displayName: string,
  action: string
): AuthResponse {
  const providerKey = `${provider}:${providerSubject}`;
  let user = state.users.find((entry) => `${entry.provider}:${entry.providerSubject}` === providerKey);
  if (!user) {
    user = {
      id: randomUUID(),
      provider,
      providerSubject,
      displayName,
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
    audit("user.create", "user", user.id, user.id, { provider });
  }
  const session = createSession(user);
  audit(action, "auth", user.id, user.id, { provider });
  persist();
  return { token: session.token, refreshToken: session.refreshToken, user };
}

function verifyDevProvider(provider: AuthProvider, providerSubject: string, displayName: string) {
  if (!isAuthProvider(provider)) {
    throw new HttpError(400, "Unsupported auth provider.");
  }
  if (!providerSubject || !displayName) {
    throw new HttpError(400, "Provider subject and display name are required.");
  }
  return { provider, providerSubject, displayName };
}

function verifyProviderToken(request: ProviderLoginRequest) {
  if (!isAuthProvider(request.provider)) {
    throw new HttpError(400, "Unsupported auth provider.");
  }

  const token = request.idToken ?? request.accessToken ?? request.authorizationCode;
  if (!token) {
    throw new HttpError(400, "Provider login requires idToken, accessToken, or authorizationCode.");
  }

  if (process.env.SPATIAL_SPRAY_ALLOW_STUB_PROVIDER_TOKENS !== "true") {
    throw new HttpError(501, "Production provider verification is not configured. Enable provider adapters before using /auth/provider-login.");
  }

  const digest = createHash("sha256").update(`${request.provider}:${token}`).digest("hex").slice(0, 20);
  return {
    provider: request.provider,
    providerSubject: `stub-${digest}`,
    displayName: `${request.provider} verified user`
  };
}

function claimUsername(user: UserProfile, rawUsername: string): UserProfile {
  const username = validateUsername(rawUsername);
  const existing = state.users.find((entry) => entry.username && normalizeUsername(entry.username) === username);
  if (existing && existing.id !== user.id) {
    throw new HttpError(409, "Username is already taken.");
  }

  const updated = { ...user, username };
  replaceUser(updated);
  audit("user.claim-username", "user", user.id, user.id, { username });
  persist();
  return updated;
}

function createSpray(user: UserProfile, request: CreateSprayPieceRequest): SprayPiece {
  if (!user.username) {
    throw new HttpError(403, "Claim a unique username before creating spray pieces.");
  }
  assertGeoPoint(request.geo);
  assertLocationAllowed(request.geo);
  if (!request.strokes?.length) {
    throw new HttpError(400, "At least one spray stroke is required.");
  }
  if (!request.anchor?.provider || !request.anchor.surfacePose) {
    throw new HttpError(400, "Anchor provider and surface pose are required.");
  }

  const now = new Date().toISOString();
  const spray: SprayPiece = {
    id: randomUUID(),
    ownerUserId: user.id,
    username: user.username,
    title: request.title.trim() || "Untitled spray",
    geo: request.geo,
    geohash: simpleGeoHash(request.geo),
    anchor: request.anchor,
    strokes: request.strokes,
    visibility: request.visibility,
    moderationStatus: "visible",
    previewImageUrl: request.previewImageUrl,
    createdAt: now,
    updatedAt: now
  };
  state.sprays.push(spray);
  audit("spray.create", "spray", spray.id, user.id, { visibility: spray.visibility, geohash: spray.geohash });
  persist();
  return spray;
}

function nearbySprays(center: { latitude: number; longitude: number }, radiusMeters: number, user?: UserProfile): SprayPiece[] {
  const blocked = user ? new Set(state.blocks.filter((block) => block.userId === user.id).map((block) => block.blockedUserId)) : new Set<string>();
  return state.sprays
    .filter((spray) => spray.visibility === "public")
    .filter((spray) => spray.moderationStatus === "visible" || spray.moderationStatus === "reported")
    .filter((spray) => !blocked.has(spray.ownerUserId))
    .map((spray) => ({ ...spray, distanceMeters: Math.round(distanceMeters(center, spray.geo)) }))
    .filter((spray) => (spray.distanceMeters ?? Number.POSITIVE_INFINITY) <= radiusMeters)
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, 100);
}

function sprayClusters(center: { latitude: number; longitude: number }, radiusMeters: number, cellMeters: number, user?: UserProfile): SprayCluster[] {
  const groups = new Map<string, SprayPiece[]>();
  for (const spray of nearbySprays(center, radiusMeters, user)) {
    const latCell = Math.floor((spray.geo.latitude * 111_111) / cellMeters);
    const lngScale = Math.max(0.2, Math.cos((spray.geo.latitude * Math.PI) / 180));
    const lngCell = Math.floor((spray.geo.longitude * 111_111 * lngScale) / cellMeters);
    const key = `${latCell}:${lngCell}`;
    groups.set(key, [...(groups.get(key) ?? []), spray]);
  }

  return Array.from(groups.entries())
    .map(([id, sprays]) => {
      const centerPoint = {
        latitude: average(sprays.map((spray) => spray.geo.latitude)),
        longitude: average(sprays.map((spray) => spray.geo.longitude))
      };
      return {
        id,
        center: centerPoint,
        count: sprays.length,
        sampleSprayIds: sprays.slice(0, 5).map((spray) => spray.id),
        distanceMeters: Math.round(distanceMeters(center, centerPoint))
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function reportSpray(user: UserProfile, sprayId: string, request: ReportSprayRequest): ReportSprayResponse {
  const spray = findSpray(sprayId);
  if (!request.reason || !reportReasons.has(request.reason)) {
    throw new HttpError(400, "Report reason is required.");
  }

  const report: ModerationReport = {
    id: randomUUID(),
    sprayId,
    reporterUserId: user.id,
    reason: request.reason,
    note: request.note,
    createdAt: new Date().toISOString()
  };
  state.reports.push(report);

  spray.moderationStatus = state.reports.filter((entry) => entry.sprayId === sprayId).length >= 3 ? "hidden" : "reported";
  spray.updatedAt = new Date().toISOString();
  audit("spray.report", "report", report.id, user.id, { sprayId, reason: report.reason });
  persist();
  return { moderationStatus: spray.moderationStatus };
}

function blockUser(user: UserProfile, request: BlockUserRequest): BlockUserResponse {
  if (!request.blockedUserId || !state.users.some((entry) => entry.id === request.blockedUserId)) {
    throw new HttpError(404, "Blocked user not found.");
  }
  if (!state.blocks.some((block) => block.userId === user.id && block.blockedUserId === request.blockedUserId)) {
    state.blocks.push({ userId: user.id, blockedUserId: request.blockedUserId, createdAt: new Date().toISOString() });
    audit("user.block", "user", request.blockedUserId, user.id);
    persist();
  }
  return { blockedUserId: request.blockedUserId };
}

function setModerationStatus(sprayId: string, action: AdminModerationAction, note?: string): SetModerationStatusResponse {
  if (!moderationActions.has(action)) {
    throw new HttpError(400, "Unsupported moderation action.");
  }
  const spray = findSpray(sprayId);
  const nextStatus = action === "mark-visible" ? "visible" : action === "hide" ? "hidden" : "removed";
  spray.moderationStatus = nextStatus;
  spray.updatedAt = new Date().toISOString();
  audit("moderation.spray-status", "spray", spray.id, undefined, { action, note: note ?? "" });
  persist();
  return { spray };
}

function createLocationDenylistEntry(request: CreateLocationDenylistEntryRequest): LocationDenylistEntry {
  assertGeoPoint(request.center);
  if (!request.name.trim() || !request.reason.trim()) {
    throw new HttpError(400, "Denylist name and reason are required.");
  }
  if (!Number.isFinite(request.radiusMeters) || request.radiusMeters <= 0 || request.radiusMeters > 10_000) {
    throw new HttpError(400, "Denylist radius must be between 1 and 10000 meters.");
  }
  const entry: LocationDenylistEntry = {
    id: randomUUID(),
    name: request.name.trim(),
    center: request.center,
    radiusMeters: request.radiusMeters,
    reason: request.reason.trim(),
    createdAt: new Date().toISOString()
  };
  state.locationDenylist.push(entry);
  audit("location-denylist.create", "location", entry.id, undefined, { name: entry.name });
  persist();
  return entry;
}

function findVisibleSpray(id: string): SprayPiece {
  const spray = findSpray(id);
  if (spray.moderationStatus === "removed") {
    throw new HttpError(404, "Spray not found.");
  }
  return spray;
}

function findSpray(id: string): SprayPiece {
  const spray = state.sprays.find((entry) => entry.id === id);
  if (!spray) {
    throw new HttpError(404, "Spray not found.");
  }
  return spray;
}

function assertLocationAllowed(point: { latitude: number; longitude: number }) {
  const blocked = state.locationDenylist.find((entry) => distanceMeters(point, entry.center) <= entry.radiusMeters);
  if (blocked) {
    throw new HttpError(403, `Spray creation is disabled here: ${blocked.name}`);
  }
}

function requireSession(request: IncomingMessage): StoredSession {
  const token = bearerToken(request);
  const session = token ? state.sessions.find((entry) => entry.token === token) : undefined;
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    throw new HttpError(401, "Authentication required.");
  }
  return session;
}

function requireUser(request: IncomingMessage): UserProfile {
  return getUser(requireSession(request).userId);
}

function optionalUser(request: IncomingMessage): UserProfile | undefined {
  const token = bearerToken(request);
  const session = token ? state.sessions.find((entry) => entry.token === token && Date.parse(entry.expiresAt) > Date.now()) : undefined;
  return session ? state.users.find((entry) => entry.id === session.userId) : undefined;
}

function requireAdmin(request: IncomingMessage) {
  if (request.headers["x-admin-token"] !== adminToken) {
    throw new HttpError(403, "Admin token required.");
  }
}

function createSession(user: UserProfile): StoredSession {
  const now = new Date();
  const session: StoredSession = {
    token: randomUUID(),
    refreshToken: randomUUID(),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 8).toISOString()
  };
  state.sessions.push(session);
  return session;
}

function getUser(userId: string): UserProfile {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new HttpError(401, "User not found.");
  }
  return user;
}

function replaceUser(user: UserProfile) {
  state.users = state.users.map((entry) => (entry.id === user.id ? user : entry));
}

function bearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/.exec(Array.isArray(authorization) ? authorization[0] ?? "" : authorization);
  return match?.[1] ?? null;
}

function readCenter(url: URL) {
  return {
    latitude: requiredNumber(url.searchParams.get("lat"), "lat"),
    longitude: requiredNumber(url.searchParams.get("lng"), "lng")
  };
}

function audit(
  action: string,
  targetType: AuditLogEntry["targetType"],
  targetId?: string,
  actorUserId?: string,
  metadata?: Record<string, string | number | boolean>
) {
  state.auditLog.push({
    id: randomUUID(),
    action,
    targetType,
    targetId,
    actorUserId,
    metadata,
    createdAt: new Date().toISOString()
  });
  state.auditLog = state.auditLog.slice(-2000);
}

function loadState(): AppState {
  if (existsSync(dataPath)) {
    const parsed = JSON.parse(readFileSync(dataPath, "utf8")) as Partial<AppState>;
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      sprays: parsed.sprays ?? [],
      reports: parsed.reports ?? [],
      blocks: parsed.blocks ?? [],
      locationDenylist: parsed.locationDenylist ?? [],
      auditLog: parsed.auditLog ?? []
    };
  }

  const initial = seedState();
  mkdirSync(dirname(dataPath), { recursive: true });
  writeFileSync(dataPath, JSON.stringify(initial, null, 2));
  return initial;
}

function persist() {
  mkdirSync(dirname(dataPath), { recursive: true });
  writeFileSync(dataPath, JSON.stringify(state, null, 2));
}

function seedState(): AppState {
  const now = new Date().toISOString();
  const demoUser: UserProfile = {
    id: "demo-artist",
    provider: "apple",
    providerSubject: "demo",
    displayName: "Demo Artist",
    username: "demo_artist",
    createdAt: now
  };

  return {
    users: [demoUser],
    sessions: [],
    reports: [],
    blocks: [],
    locationDenylist: [],
    auditLog: [
      {
        id: randomUUID(),
        action: "system.seed",
        targetType: "system",
        createdAt: now
      }
    ],
    sprays: [
      {
        id: "demo-spray-1",
        ownerUserId: demoUser.id,
        username: "demo_artist",
        title: "Market Street wall",
        geo: { latitude: 37.7749, longitude: -122.4194, horizontalAccuracyMeters: 12 },
        geohash: "37.77490:-122.41940",
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
        strokes: [],
        visibility: "public",
        moderationStatus: "visible",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function requiredNumber(value: string | null, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${label} must be a number.`);
  }
  return parsed;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function setCors(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization,content-type,x-admin-token");
}

class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}
