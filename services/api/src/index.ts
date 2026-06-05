import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  assertGeoPoint,
  distanceMeters,
  isAuthProvider,
  normalizeUsername,
  simpleGeoHash,
  validateUsername,
  type AuthRequest,
  type AuthResponse,
  type BlockUserRequest,
  type BlockUserResponse,
  type ClaimUsernameRequest,
  type ClaimUsernameResponse,
  type CreateSprayPieceRequest,
  type CreateSprayPieceResponse,
  type NearbySpraysResponse,
  type ReportSprayRequest,
  type ReportSprayResponse,
  type SprayPiece,
  type UserProfile
} from "@spatial-spray/contracts";

interface Session {
  token: string;
  userId: string;
  createdAt: string;
}

interface Report {
  id: string;
  sprayId: string;
  reporterUserId: string;
  reason: ReportSprayRequest["reason"];
  note?: string;
  createdAt: string;
}

const port = Number(process.env.PORT ?? 4301);
const users = new Map<string, UserProfile>();
const usersByProvider = new Map<string, string>();
const usersByUsername = new Map<string, string>();
const sessions = new Map<string, Session>();
const sprays = new Map<string, SprayPiece>();
const reports: Report[] = [];
const blockedUsersByUser = new Map<string, Set<string>>();

seedDemoSprays();

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
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "spatial-spray-api" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/dev-login") {
    const body = await readJson<AuthRequest>(request);
    const payload: AuthResponse = devLogin(body);
    sendJson(response, 201, payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/me") {
    const user = requireUser(request);
    sendJson(response, 200, { user });
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
    const center = {
      latitude: requiredNumber(url.searchParams.get("lat"), "lat"),
      longitude: requiredNumber(url.searchParams.get("lng"), "lng")
    };
    const radiusMeters = Math.min(requiredNumber(url.searchParams.get("radiusMeters") ?? "1000", "radiusMeters"), 5000);
    const payload: NearbySpraysResponse = {
      sprays: nearbySprays(center, radiusMeters, user)
    };
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
  if (request.method === "GET" && sprayMatch) {
    const spray = sprays.get(sprayMatch[1] ?? "");
    if (!spray || spray.moderationStatus === "removed") {
      throw new HttpError(404, "Spray not found.");
    }
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

  if (request.method === "GET" && url.pathname === "/moderation/reports") {
    requireAdmin(request);
    sendJson(response, 200, { reports });
    return;
  }

  throw new HttpError(404, "Not found.");
}

function devLogin(request: AuthRequest): AuthResponse {
  if (!isAuthProvider(request.provider)) {
    throw new HttpError(400, "Unsupported auth provider.");
  }
  if (!request.providerSubject || !request.displayName) {
    throw new HttpError(400, "Provider subject and display name are required.");
  }

  const providerKey = `${request.provider}:${request.providerSubject}`;
  let user = usersByProvider.get(providerKey) ? users.get(usersByProvider.get(providerKey)!) : undefined;
  if (!user) {
    user = {
      id: randomUUID(),
      provider: request.provider,
      providerSubject: request.providerSubject,
      displayName: request.displayName,
      createdAt: new Date().toISOString()
    };
    users.set(user.id, user);
    usersByProvider.set(providerKey, user.id);
  }

  const token = randomUUID();
  sessions.set(token, { token, userId: user.id, createdAt: new Date().toISOString() });
  return { token, user };
}

function claimUsername(user: UserProfile, rawUsername: string): UserProfile {
  const username = validateUsername(rawUsername);
  const existing = usersByUsername.get(username);
  if (existing && existing !== user.id) {
    throw new HttpError(409, "Username is already taken.");
  }

  if (user.username && normalizeUsername(user.username) !== username) {
    usersByUsername.delete(normalizeUsername(user.username));
  }

  const updated = { ...user, username };
  users.set(user.id, updated);
  usersByUsername.set(username, user.id);
  return updated;
}

function createSpray(user: UserProfile, request: CreateSprayPieceRequest): SprayPiece {
  if (!user.username) {
    throw new HttpError(403, "Claim a unique username before creating spray pieces.");
  }
  assertGeoPoint(request.geo);
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
  sprays.set(spray.id, spray);
  return spray;
}

function nearbySprays(center: { latitude: number; longitude: number }, radiusMeters: number, user?: UserProfile): SprayPiece[] {
  const blocked = user ? blockedUsersByUser.get(user.id) ?? new Set<string>() : new Set<string>();
  return Array.from(sprays.values())
    .filter((spray) => spray.visibility === "public")
    .filter((spray) => spray.moderationStatus === "visible" || spray.moderationStatus === "reported")
    .filter((spray) => !blocked.has(spray.ownerUserId))
    .map((spray) => ({ ...spray, distanceMeters: Math.round(distanceMeters(center, spray.geo)) }))
    .filter((spray) => (spray.distanceMeters ?? Number.POSITIVE_INFINITY) <= radiusMeters)
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, 100);
}

function reportSpray(user: UserProfile, sprayId: string, request: ReportSprayRequest): ReportSprayResponse {
  const spray = sprays.get(sprayId);
  if (!spray) {
    throw new HttpError(404, "Spray not found.");
  }
  if (!request.reason) {
    throw new HttpError(400, "Report reason is required.");
  }

  reports.push({
    id: randomUUID(),
    sprayId,
    reporterUserId: user.id,
    reason: request.reason,
    note: request.note,
    createdAt: new Date().toISOString()
  });

  const updated: SprayPiece = {
    ...spray,
    moderationStatus: reports.filter((report) => report.sprayId === sprayId).length >= 3 ? "hidden" : "reported",
    updatedAt: new Date().toISOString()
  };
  sprays.set(sprayId, updated);
  return { moderationStatus: updated.moderationStatus };
}

function blockUser(user: UserProfile, request: BlockUserRequest): BlockUserResponse {
  if (!request.blockedUserId || !users.has(request.blockedUserId)) {
    throw new HttpError(404, "Blocked user not found.");
  }
  const blocked = blockedUsersByUser.get(user.id) ?? new Set<string>();
  blocked.add(request.blockedUserId);
  blockedUsersByUser.set(user.id, blocked);
  return { blockedUserId: request.blockedUserId };
}

function requireUser(request: IncomingMessage): UserProfile {
  const token = bearerToken(request);
  const session = token ? sessions.get(token) : undefined;
  const user = session ? users.get(session.userId) : undefined;
  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }
  return user;
}

function optionalUser(request: IncomingMessage): UserProfile | undefined {
  const token = bearerToken(request);
  const session = token ? sessions.get(token) : undefined;
  return session ? users.get(session.userId) : undefined;
}

function requireAdmin(request: IncomingMessage) {
  if (request.headers["x-admin-token"] !== (process.env.ADMIN_TOKEN ?? "local-admin")) {
    throw new HttpError(403, "Admin token required.");
  }
}

function bearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/.exec(Array.isArray(authorization) ? authorization[0] ?? "" : authorization);
  return match?.[1] ?? null;
}

function seedDemoSprays() {
  const now = new Date().toISOString();
  const demoUser: UserProfile = {
    id: "demo-artist",
    provider: "apple",
    providerSubject: "demo",
    displayName: "Demo Artist",
    username: "demo_artist",
    createdAt: now
  };
  users.set(demoUser.id, demoUser);
  usersByUsername.set("demo_artist", demoUser.id);

  const spray: SprayPiece = {
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
  };
  sprays.set(spray.id, spray);
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

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function setCors(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization,content-type,x-admin-token");
}

class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

