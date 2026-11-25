import { Color, MeshBasicMaterial, MeshLambertMaterial } from 'three';

/** Matte materials only: true colors, soft shading, no reflections or glare. */
export function createMaterials(color: string, accent: string, ink: string) {
  const matte = (c: string | Color) => new MeshLambertMaterial({ color: c });
  return {
    body: matte(color),
    accent: matte(accent),
    light: matte(new Color(color).lerp(new Color('#ffffff'), 0.55)),
    ink: matte(ink),
    white: new MeshBasicMaterial({ color: '#ffffff' }),
    cheek: new MeshLambertMaterial({ color: '#ff7f98', transparent: true, opacity: 0.5, depthWrite: false }),
    glow: new MeshBasicMaterial({ color: '#fff1c7' }),
    gold: matte('#f2bd3a'),
  };
}

export type Materials = ReturnType<typeof createMaterials>;

export function disposeMaterials(m: Materials) {
  Object.values(m).forEach((mat) => mat.dispose());
}
