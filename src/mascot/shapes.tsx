import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import { BufferGeometry, ExtrudeGeometry, LatheGeometry, Quaternion, Shape, SphereGeometry, Vector2, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Species } from './config';
import type { Materials } from './materials';
import { ellipsoid, lathe, makeSurface, plane, type Surface } from './surface';

/*
 * Every character is built from simple 3D primitives, about 2 units tall,
 * centered on the origin and facing +z.
 */

export interface FaceLayout {
  eyeY: number;
  eyeDx: number;
  mouthY: number;
  cheekY: number;
  cheekDx: number;
  /** Extra height for mouths that sit on a muzzle. */
  mouthLift?: number;
  /** Size multiplier for eyes and mouth. */
  scale?: number;
  /** Where a nose sits. Defaults to between the eyes and mouth. */
  noseY?: number;
}

export interface ShapeDef {
  Body: (p: { m: Materials; surface: Surface }) => ReactNode;
  surface: Surface;
  face: FaceLayout;
  /** Y where accessories sit. */
  top: number;
}

/**
 * Body proportions (width, height, depth). Face parts follow the stretched surface
 * without being stretched themselves, so eyes stay round on a wide body.
 */
export const StretchContext = createContext<[number, number, number]>([1, 1, 1]);

const FORWARD = new Vector3(0, 0, 1);

export function OnSurface({
  surface,
  at,
  lift = 0.005,
  children,
}: {
  surface: Surface;
  at: [number, number];
  lift?: number;
  children: ReactNode;
}) {
  const [sx, sy, sz] = useContext(StretchContext);
  const [x, y] = at;
  const a = useMemo(() => {
    const base = surface(x, y, 0);
    const n = FORWARD.clone().applyQuaternion(base.quaternion);
    n.set(n.x / sx, n.y / sy, n.z / sz).normalize();
    const p = new Vector3(base.position[0] * sx, base.position[1] * sy, base.position[2] * sz).addScaledVector(n, lift);
    return { position: p.toArray(), quaternion: new Quaternion().setFromUnitVectors(FORWARD, n) };
  }, [surface, x, y, lift, sx, sy, sz]);
  return (
    <group position={a.position} quaternion={a.quaternion}>
      {children}
    </group>
  );
}

const cached = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};

function latheGeometry(r: (y: number) => number, y0: number, y1: number) {
  const pts = [new Vector2(0, y0)];
  for (let i = 0; i <= 64; i++) {
    const y = y0 + ((y1 - y0) * i) / 64;
    pts.push(new Vector2(Math.max(r(y), 0.0001), y));
  }
  pts.push(new Vector2(0, y1));
  return new LatheGeometry(pts, 72);
}

const eggR = (y: number) => (y < 0 ? 0.98 * Math.sqrt(Math.max(0, 1 - y * y)) : 0.98 * Math.sqrt(Math.max(0, 1 - (y / 1.2) ** 2)) * (1 - 0.14 * (y / 1.2)));
const dropR = (y: number) =>
  y < 0 ? 0.95 * Math.sqrt(Math.max(0, 1 - (y / 0.95) ** 2)) : 0.95 * Math.pow(Math.max(0, Math.cos((Math.PI / 2) * (y / 1.4))), 1.6);
const ghostR = (y: number) => (y >= 0 ? 0.92 * Math.sqrt(Math.max(0, 1 - (y / 0.95) ** 2)) : 0.92 + 0.12 * (y / 1.05) ** 2);
const lampR = (y: number) => 1.0 - 0.45 * ((y - 0.08) / 0.97);
const pillR = (y: number) => (Math.abs(y) <= 0.35 ? 0.8 : Math.sqrt(Math.max(0, 0.64 - (Math.abs(y) - 0.35) ** 2)));

const geo = {
  egg: cached(() => latheGeometry(eggR, -1, 1.2)),
  drop: cached(() => latheGeometry(dropR, -0.95, 1.4)),
  ghost: cached(() => latheGeometry(ghostR, -1.05, 0.95)),
  lamp: cached(() => latheGeometry(lampR, 0.08, 1.05)),
  triangle: cached(() => {
    const r = 0.28;
    const pts = [new Vector2(0, 1.1), new Vector2(-1.1, -0.85), new Vector2(1.1, -0.85)];
    const shape = new Shape();
    pts.forEach((p, i) => {
      const prev = pts[(i + 2) % 3];
      const next = pts[(i + 1) % 3];
      const a = p.clone().add(prev.clone().sub(p).setLength(r));
      const b = p.clone().add(next.clone().sub(p).setLength(r));
      if (i === 0) shape.moveTo(a.x, a.y);
      else shape.lineTo(a.x, a.y);
      shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
    });
    shape.closePath();
    const g = new ExtrudeGeometry(shape, {
      depth: 0.9,
      bevelEnabled: true,
      bevelThickness: 0.27,
      bevelSize: 0.22,
      bevelSegments: 10,
      curveSegments: 24,
    });
    g.translate(0, 0, -0.45);
    return g;
  }),
  blob: cached(() => {
    let g: BufferGeometry = new SphereGeometry(1, 96, 64);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position;
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = v.clone().normalize();
      const sides = 1 - Math.max(0, n.z);
      v.multiplyScalar(1 + 0.08 * sides * Math.sin(3 * Math.atan2(n.y, n.x) + 0.6));
      p.setXYZ(i, v.x * 1.12, v.y * 0.92, v.z);
    }
    g.computeVertexNormals();
    return g;
  }),
};

const SPHERE = <sphereGeometry args={[1, 96, 64]} />;

export const SHAPES: Record<Species, ShapeDef> = {
  /* ---------- Shapes ---------- */
  blob: {
    Body: ({ m }) => <mesh geometry={geo.blob()} material={m.body} />,
    surface: makeSurface([ellipsoid(0, 0, 0, 1.12, 0.92, 1)]),
    face: { eyeY: 0.12, eyeDx: 0.32, mouthY: -0.17, cheekY: -0.07, cheekDx: 0.56 },
    top: 0.9,
  },
  sphere: {
    Body: ({ m }) => <mesh material={m.body}>{SPHERE}</mesh>,
    surface: makeSurface([ellipsoid(0, 0, 0, 1, 1, 1)]),
    face: { eyeY: 0.16, eyeDx: 0.3, mouthY: -0.15, cheekY: -0.05, cheekDx: 0.52 },
    top: 1,
  },
  cube: {
    Body: ({ m }) => <RoundedBox args={[1.9, 1.7, 1.6]} radius={0.4} smoothness={8} material={m.body} />,
    surface: makeSurface([plane(0.8, 0.55, 0.45)]),
    face: { eyeY: 0.14, eyeDx: 0.3, mouthY: -0.16, cheekY: -0.06, cheekDx: 0.52 },
    top: 0.85,
  },
  pill: {
    Body: ({ m }) => (
      <mesh material={m.body}>
        <capsuleGeometry args={[0.8, 0.7, 24, 64]} />
      </mesh>
    ),
    surface: makeSurface([lathe(pillR, -1.15, 1.15)]),
    face: { eyeY: 0.22, eyeDx: 0.27, mouthY: -0.1, cheekY: 0.01, cheekDx: 0.48 },
    top: 1.15,
  },
  egg: {
    Body: ({ m }) => <mesh geometry={geo.egg()} material={m.body} />,
    surface: makeSurface([lathe(eggR, -1, 1.2)]),
    face: { eyeY: 0.18, eyeDx: 0.3, mouthY: -0.13, cheekY: -0.04, cheekDx: 0.52 },
    top: 1.2,
  },
  drop: {
    Body: ({ m }) => <mesh geometry={geo.drop()} material={m.body} />,
    surface: makeSurface([lathe(dropR, -0.95, 1.4)]),
    face: { eyeY: 0.1, eyeDx: 0.3, mouthY: -0.2, cheekY: -0.1, cheekDx: 0.52 },
    top: 1.38,
  },
  cloud: {
    Body: ({ m }) => (
      <group>
        {[
          [0, 0.05, 0, 0.82],
          [-0.74, -0.18, -0.08, 0.56],
          [0.74, -0.18, -0.08, 0.56],
          [-0.36, 0.56, -0.12, 0.5],
          [0.4, 0.5, -0.12, 0.56],
          [0, -0.36, -0.05, 0.62],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={r} material={m.body}>
            {SPHERE}
          </mesh>
        ))}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, 0.05, 0, 0.82, 0.82, 0.82), ellipsoid(0, -0.36, -0.05, 0.62, 0.62, 0.62)]),
    face: { eyeY: 0.14, eyeDx: 0.27, mouthY: -0.16, cheekY: -0.06, cheekDx: 0.48 },
    top: 0.98,
  },
  ghost: {
    Body: ({ m }) => (
      <group>
        <mesh geometry={geo.ghost()} material={m.body} />
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.82, -1.02, Math.cos(a) * 0.82]} scale={0.24} material={m.body}>
              {SPHERE}
            </mesh>
          );
        })}
      </group>
    ),
    surface: makeSurface([lathe(ghostR, -1.05, 0.95)]),
    face: { eyeY: 0.18, eyeDx: 0.3, mouthY: -0.12, cheekY: -0.03, cheekDx: 0.52 },
    top: 0.95,
  },

  triangle: {
    Body: ({ m }) => <mesh geometry={geo.triangle()} material={m.body} />,
    surface: makeSurface([plane(0.72, 0.55, 0.45, -0.25)]),
    face: { eyeY: -0.1, eyeDx: 0.28, mouthY: -0.38, cheekY: -0.3, cheekDx: 0.52 },
    top: 1.05,
  },
  sun: {
    Body: ({ m }) => (
      <group>
        <mesh scale={0.85} material={m.body}>
          {SPHERE}
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = ((i + 0.5) / 10) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 1.0, Math.cos(a) * 1.0, -0.1]}
              rotation={[0, 0, -a]}
              scale={[1, 1, 0.55]}
              material={m.accent}
            >
              <coneGeometry args={[0.17, 0.36, 24]} />
            </mesh>
          );
        })}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, 0, 0, 0.85, 0.85, 0.85)]),
    face: { eyeY: 0.12, eyeDx: 0.26, mouthY: -0.17, cheekY: -0.08, cheekDx: 0.46 },
    top: 0.85,
  },
  lamp: {
    Body: ({ m }) => (
      <group>
        <mesh geometry={geo.lamp()} material={m.body} />
        <mesh position={[0, 0.06, 0]} material={m.glow}>
          <sphereGeometry args={[0.22, 24, 16]} />
        </mesh>
        <mesh position={[0, -0.25, 0]} material={m.accent}>
          <cylinderGeometry args={[0.06, 0.06, 0.6, 16]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} material={m.accent}>
          <cylinderGeometry args={[0.5, 0.6, 0.16, 48]} />
        </mesh>
      </group>
    ),
    surface: makeSurface([lathe(lampR, 0.08, 1.05)]),
    face: { eyeY: 0.6, eyeDx: 0.24, mouthY: 0.36, cheekY: 0.42, cheekDx: 0.46 },
    top: 1.05,
  },
  coin: {
    Body: ({ m }) => (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.body}>
          <cylinderGeometry args={[1, 1, 0.3, 64]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0, 0.15 * s]} material={m.body}>
            <torusGeometry args={[0.9, 0.06, 16, 64]} />
          </mesh>
        ))}
      </group>
    ),
    surface: makeSurface([plane(0.15, 0.7, 0.7)]),
    face: { eyeY: 0.14, eyeDx: 0.28, mouthY: -0.18, cheekY: -0.08, cheekDx: 0.52 },
    top: 1,
  },

  /* ---------- Animals ---------- */
  pig: {
    Body: ({ m }) => (
      <group>
        <mesh scale={[1.1, 0.95, 0.95]} material={m.body}>
          {SPHERE}
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[0.56 * s, 0.82, 0.05]} rotation={[0.2, 0, -0.5 * s]} material={m.accent}>
              <coneGeometry args={[0.24, 0.38, 32]} />
            </mesh>
            <mesh position={[0.46 * s, -0.86, 0.32]} scale={[0.2, 0.13, 0.2]} material={m.accent}>
              {SPHERE}
            </mesh>
          </group>
        ))}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, 0, 0, 1.1, 0.95, 0.95)]),
    face: { eyeY: 0.22, eyeDx: 0.38, noseY: -0.12, mouthY: -0.2, cheekY: -0.12, cheekDx: 0.68 },
    top: 0.95,
  },
  cat: {
    Body: ({ m, surface }) => (
      <group>
        <mesh material={m.body}>{SPHERE}</mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0.58 * s, 0.84, 0]} rotation={[0, 0, -0.42 * s]}>
            <mesh material={m.body}>
              <coneGeometry args={[0.32, 0.56, 48, 1]} />
            </mesh>
            <mesh position={[0, -0.04, 0.14]} scale={[1, 1, 0.4]} material={m.accent}>
              <coneGeometry args={[0.18, 0.34, 48, 1]} />
            </mesh>
          </group>
        ))}
        {[-1, 1].flatMap((s) =>
          [0.06, -0.06].map((dy) => (
            <OnSurface key={`${s}${dy}`} surface={surface} at={[0.62 * s, -0.08 + dy]}>
              <mesh rotation={[0, 0, Math.PI / 2 + dy * 3 * s]} material={m.ink}>
                <capsuleGeometry args={[0.012, 0.26, 4, 8]} />
              </mesh>
            </OnSurface>
          )),
        )}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, 0, 0, 1, 1, 1)]),
    face: { eyeY: 0.18, eyeDx: 0.33, noseY: -0.05, mouthY: -0.2, cheekY: -0.12, cheekDx: 0.52 },
    top: 1,
  },
  bear: {
    Body: ({ m }) => (
      <group>
        <mesh material={m.body}>{SPHERE}</mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0.68 * s, 0.72, -0.05]}>
            <mesh scale={[0.33, 0.33, 0.2]} material={m.body}>
              {SPHERE}
            </mesh>
            <mesh position={[0, 0, 0.1]} scale={[0.18, 0.18, 0.08]} material={m.accent}>
              {SPHERE}
            </mesh>
          </group>
        ))}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, 0, 0, 1, 1, 1)]),
    face: { eyeY: 0.16, eyeDx: 0.34, noseY: -0.2, mouthY: -0.18, cheekY: -0.12, cheekDx: 0.6 },
    top: 1,
  },
  bunny: {
    Body: ({ m }) => (
      <group>
        <mesh position={[0, -0.05, 0]} scale={[0.96, 0.92, 0.9]} material={m.body}>
          {SPHERE}
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0.42 * s, 1.18, -0.08]} rotation={[-0.1, 0, -0.3 * s]}>
            <mesh scale={[1, 1, 0.7]} material={m.body}>
              <capsuleGeometry args={[0.17, 0.72, 12, 24]} />
            </mesh>
            <mesh position={[0, -0.02, 0.09]} scale={[1, 1, 0.35]} material={m.accent}>
              <capsuleGeometry args={[0.09, 0.56, 12, 24]} />
            </mesh>
          </group>
        ))}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, -0.05, 0, 0.96, 0.92, 0.9)]),
    face: { eyeY: 0.08, eyeDx: 0.32, noseY: -0.12, mouthY: -0.24, cheekY: -0.16, cheekDx: 0.54 },
    top: 0.85,
  },
  frog: {
    Body: ({ m }) => (
      <group>
        <mesh scale={[1.2, 0.85, 1]} material={m.body}>
          {SPHERE}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.48 * s, 0.68, 0.28]} scale={0.38} material={m.body}>
            {SPHERE}
          </mesh>
        ))}
      </group>
    ),
    surface: makeSurface([
      ellipsoid(0, 0, 0, 1.2, 0.85, 1),
      ellipsoid(-0.48, 0.68, 0.28, 0.38, 0.38, 0.38),
      ellipsoid(0.48, 0.68, 0.28, 0.38, 0.38, 0.38),
    ]),
    face: { eyeY: 0.7, eyeDx: 0.48, mouthY: -0.12, cheekY: -0.08, cheekDx: 0.78, scale: 1.1 },
    top: 0.82,
  },
  chick: {
    Body: ({ m }) => (
      <group>
        <mesh material={m.body}>{SPHERE}</mesh>
        {[-1, 0, 1].map((s) => (
          <mesh key={s} position={[0.11 * s, 1.0, 0]} rotation={[0, 0, -0.5 * s]} scale={[0.07, 0.17, 0.07]} material={m.body}>
            {SPHERE}
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.95 * s, -0.12, 0]} rotation={[0, 0, 0.35 * s]} scale={[0.14, 0.36, 0.3]} material={m.body}>
            {SPHERE}
          </mesh>
        ))}
      </group>
    ),
    surface: makeSurface([ellipsoid(0, 0, 0, 1, 1, 1)]),
    face: { eyeY: 0.2, eyeDx: 0.32, noseY: -0.07, mouthY: -0.2, cheekY: -0.1, cheekDx: 0.54 },
    top: 1.08,
  },
  monster: {
    Body: ({ m }) => (
      <group>
        <RoundedBox args={[1.8, 1.75, 1.5]} radius={0.48} smoothness={8} material={m.body} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.55 * s, 1.0, 0]} rotation={[0, 0, -0.35 * s]} material={m.accent}>
            <coneGeometry args={[0.16, 0.5, 32]} />
          </mesh>
        ))}
      </group>
    ),
    surface: makeSurface([plane(0.75, 0.42, 0.4)]),
    face: { eyeY: 0.16, eyeDx: 0.3, mouthY: -0.16, cheekY: -0.06, cheekDx: 0.48 },
    top: 0.88,
  },
};
