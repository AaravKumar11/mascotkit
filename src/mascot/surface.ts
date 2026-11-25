import { Quaternion, Vector3 } from 'three';

/**
 * The front of a body, described as z = f(x, y). Face parts are placed on this
 * surface and tilted to follow its curve, so the face wraps around the head in 3D.
 * Returns null where the primitive does not cover (x, y).
 */
export type SurfaceFn = (x: number, y: number) => number | null;

export const ellipsoid =
  (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): SurfaceFn =>
  (x, y) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const k = 1 - dx * dx - dy * dy;
    return k < 0 ? null : cz + rz * Math.sqrt(k);
  };

export const plane =
  (z: number, halfW: number, halfH: number, cy = 0): SurfaceFn =>
  (x, y) =>
    Math.abs(x) <= halfW && Math.abs(y - cy) <= halfH ? z : null;

/** A shape turned around the y axis with radius r(y). */
export const lathe =
  (r: (y: number) => number, y0: number, y1: number): SurfaceFn =>
  (x, y) => {
    if (y < y0 || y > y1) return null;
    const R = r(y);
    const k = R * R - x * x;
    return k < 0 ? null : Math.sqrt(k);
  };

export interface Anchor {
  position: [number, number, number];
  quaternion: Quaternion;
}

const FORWARD = new Vector3(0, 0, 1);

export function makeSurface(fns: SurfaceFn[]) {
  const z = (x: number, y: number) => {
    let best: number | null = null;
    for (const f of fns) {
      const v = f(x, y);
      if (v !== null && (best === null || v > best)) best = v;
    }
    return best ?? 0;
  };
  return (x: number, y: number, lift = 0.005): Anchor => {
    const h = 0.012;
    const n = new Vector3((z(x - h, y) - z(x + h, y)) / (2 * h), (z(x, y - h) - z(x, y + h)) / (2 * h), 1).normalize();
    const p = new Vector3(x, y, z(x, y)).addScaledVector(n, lift);
    return { position: [p.x, p.y, p.z], quaternion: new Quaternion().setFromUnitVectors(FORWARD, n) };
  };
}

export type Surface = ReturnType<typeof makeSurface>;
