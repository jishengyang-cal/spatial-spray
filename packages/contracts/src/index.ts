export type AuthProvider = "apple" | "google" | "facebook";

export type DevicePlatform = "iphone" | "visionos" | "web-simulator";

export type SprayVisibility = "public" | "unlisted" | "private";

export type ModerationStatus = "visible" | "reported" | "hidden" | "removed";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  horizontalAccuracyMeters?: number;
}

export interface SurfacePose {
  position: [number, number, number];
  normal: [number, number, number];
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
}

export type AnchorProvider = "arkit-geo" | "arkit-world" | "arcore-cloud" | "visual-vps" | "manual-local";

export interface AnchorRef {
  provider: AnchorProvider;
  id?: string;
  payload?: Record<string, string | number | boolean>;
  surfacePose: SurfacePose;
}

export type NozzleType = "soft-cap" | "fat-cap" | "skinny-cap" | "drip";

export interface SprayPoint {
  x: number;
  y: number;
  z: number;
  pressure: number;
  timestampMs: number;
}

export interface SprayStroke {
  id: string;
  color: string;
  radiusMeters: number;
  opacity: number;
  nozzle: NozzleType;
  overspray: number;
  drip: number;
  points: SprayPoint[];
}

export interface SprayPiece {
  id: string;
  ownerUserId: string;
  username: string;
  title: string;
  geo: GeoPoint;
  geohash: string;
  anchor: AnchorRef;
  strokes: SprayStroke[];
  visibility: SprayVisibility;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
  previewImageUrl?: string;
  distanceMeters?: number;
}

export interface UserProfile {
  id: string;
  provider: AuthProvider;
  providerSubject: string;
  displayName: string;
  username?: string;
  createdAt: string;
}

export interface AuthRequest {
  provider: AuthProvider;
  providerSubject: string;
  displayName: string;
  devicePlatform: DevicePlatform;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface ClaimUsernameRequest {
  username: string;
}

export interface ClaimUsernameResponse {
  user: UserProfile;
}

export interface CreateSprayPieceRequest {
  title: string;
  geo: GeoPoint;
  anchor: AnchorRef;
  strokes: SprayStroke[];
  visibility: SprayVisibility;
  previewImageUrl?: string;
}

export interface CreateSprayPieceResponse {
  spray: SprayPiece;
}

export interface NearbySpraysResponse {
  sprays: SprayPiece[];
}

export interface ReportSprayRequest {
  reason: "illegal" | "hate" | "sexual" | "harassment" | "private-property" | "spam" | "other";
  note?: string;
}

export interface ReportSprayResponse {
  moderationStatus: ModerationStatus;
}

export interface BlockUserRequest {
  blockedUserId: string;
}

export interface BlockUserResponse {
  blockedUserId: string;
}

export function isAuthProvider(value: string): value is AuthProvider {
  return value === "apple" || value === "google" || value === "facebook";
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string {
  const normalized = normalizeUsername(value);
  if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
    throw new Error("Username must be 3-24 chars and use lowercase letters, numbers, or underscore.");
  }
  if (["admin", "support", "apple", "google", "facebook", "moderator", "root"].includes(normalized)) {
    throw new Error("Username is reserved.");
  }
  return normalized;
}

export function assertGeoPoint(value: GeoPoint) {
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new Error("Invalid latitude.");
  }
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    throw new Error("Invalid longitude.");
  }
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const radius = 6371000;
  const dLat = degreesToRadians(b.latitude - a.latitude);
  const dLng = degreesToRadians(b.longitude - a.longitude);
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function simpleGeoHash(point: GeoPoint, precision = 5): string {
  return `${point.latitude.toFixed(precision)}:${point.longitude.toFixed(precision)}`;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

