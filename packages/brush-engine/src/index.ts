import type { NozzleType, SprayPoint, SprayStroke } from "@spatial-spray/contracts";

export interface Particle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export interface SprayRenderSettings {
  color: string;
  radiusPixels: number;
  opacity: number;
  nozzle: NozzleType;
  overspray: number;
  drip: number;
}

export interface DecalVertex {
  position: [number, number, number];
  uv: [number, number];
  alpha: number;
}

export interface DecalMesh {
  vertices: DecalVertex[];
  indices: number[];
  color: string;
  roughness: number;
  metallic: number;
}

export function createStroke(
  id: string,
  color: string,
  nozzle: NozzleType,
  points: SprayPoint[]
): SprayStroke {
  const profile = nozzleProfile(nozzle);
  return {
    id,
    color,
    nozzle,
    radiusMeters: profile.radiusMeters,
    opacity: profile.opacity,
    overspray: profile.overspray,
    drip: profile.drip,
    points
  };
}

export function nozzleProfile(nozzle: NozzleType): Omit<SprayStroke, "id" | "color" | "nozzle" | "points"> {
  switch (nozzle) {
    case "skinny-cap":
      return { radiusMeters: 0.018, opacity: 0.74, overspray: 0.35, drip: 0.08 };
    case "fat-cap":
      return { radiusMeters: 0.065, opacity: 0.62, overspray: 0.78, drip: 0.18 };
    case "drip":
      return { radiusMeters: 0.044, opacity: 0.82, overspray: 0.42, drip: 0.72 };
    case "soft-cap":
    default:
      return { radiusMeters: 0.038, opacity: 0.68, overspray: 0.56, drip: 0.15 };
  }
}

export function generateSprayParticles(
  x: number,
  y: number,
  pressure: number,
  settings: SprayRenderSettings,
  seed: number
): Particle[] {
  const count = Math.max(18, Math.round(80 * pressure * (0.5 + settings.overspray)));
  const particles: Particle[] = [];
  let state = seed || 1;

  for (let index = 0; index < count; index += 1) {
    state = lcg(state);
    const angle = rand(state) * Math.PI * 2;
    state = lcg(state);
    const radius = Math.sqrt(rand(state)) * settings.radiusPixels * (1 + settings.overspray);
    state = lcg(state);
    const dotRadius = 0.65 + rand(state) * Math.max(1, settings.radiusPixels * 0.12);
    state = lcg(state);
    const alpha = settings.opacity * (0.2 + rand(state) * 0.62) * pressure;
    particles.push({
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      radius: dotRadius,
      alpha
    });
  }

  return particles;
}

export function generateDrips(x: number, y: number, settings: SprayRenderSettings, seed: number): Particle[] {
  const count = Math.round(settings.drip * 8);
  const drips: Particle[] = [];
  let state = seed || 1;

  for (let index = 0; index < count; index += 1) {
    state = lcg(state);
    const dx = (rand(state) - 0.5) * settings.radiusPixels * 1.4;
    state = lcg(state);
    const length = settings.radiusPixels * (0.6 + rand(state) * 2.1) * settings.drip;
    drips.push({ x: x + dx, y: y + length, radius: 1.8, alpha: settings.opacity * 0.46 });
  }

  return drips;
}

export function distanceAttenuatedRadius(baseRadius: number, sprayDistanceMeters: number): number {
  const clamped = Math.max(0.12, Math.min(1.2, sprayDistanceMeters));
  return baseRadius * (0.65 + clamped * 0.55);
}

export function wallAbsorptionOpacity(opacity: number, wallRoughness: number): number {
  const roughness = Math.max(0, Math.min(1, wallRoughness));
  return opacity * (0.72 + roughness * 0.28);
}

export function createDecalMeshFromStroke(
  stroke: SprayStroke,
  surfaceOrigin: [number, number, number],
  surfaceRight: [number, number, number],
  surfaceUp: [number, number, number],
  options: { widthMeters: number; heightMeters: number; wallRoughness?: number; sprayDistanceMeters?: number }
): DecalMesh {
  const vertices: DecalVertex[] = [];
  const indices: number[] = [];
  const wallOpacity = wallAbsorptionOpacity(stroke.opacity, options.wallRoughness ?? 0.55);
  const radius = distanceAttenuatedRadius(stroke.radiusMeters, options.sprayDistanceMeters ?? 0.45);

  for (const point of stroke.points) {
    const center = add3(
      surfaceOrigin,
      add3(scale3(surfaceRight, (point.x - 0.5) * options.widthMeters), scale3(surfaceUp, (0.5 - point.y) * options.heightMeters))
    );
    const right = scale3(surfaceRight, radius);
    const up = scale3(surfaceUp, radius);
    const base = vertices.length;
    const alpha = Math.max(0.05, Math.min(1, point.pressure * wallOpacity));

    vertices.push(
      { position: sub3(sub3(center, right), up), uv: [0, 1], alpha },
      { position: add3(sub3(center, up), right), uv: [1, 1], alpha },
      { position: add3(add3(center, right), up), uv: [1, 0], alpha },
      { position: add3(sub3(center, right), up), uv: [0, 0], alpha }
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return {
    vertices,
    indices,
    color: stroke.color,
    roughness: 0.86,
    metallic: 0
  };
}

function lcg(value: number): number {
  return (value * 1664525 + 1013904223) >>> 0;
}

function rand(value: number): number {
  return value / 0xffffffff;
}

function add3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(value: [number, number, number], scalar: number): [number, number, number] {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}
