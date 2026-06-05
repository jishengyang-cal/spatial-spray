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

function lcg(value: number): number {
  return (value * 1664525 + 1013904223) >>> 0;
}

function rand(value: number): number {
  return value / 0xffffffff;
}

