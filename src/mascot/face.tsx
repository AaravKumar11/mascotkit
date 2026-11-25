import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { CubicBezierCurve3, TubeGeometry, Vector3, type Group, type Mesh } from 'three';
import type { Mood, Nose } from './config';
import type { Materials } from './materials';
import { OnSurface, type FaceLayout } from './shapes';
import type { Surface } from './surface';

/*
 * Every eye, brow and mouth is one rounded stroke along a curve with four control
 * points and a thickness. Every expression uses the same strokes with different
 * numbers, so switching expressions morphs the face smoothly instead of swapping parts.
 */

type P = [number, number];
interface Stroke {
  pts: [P, P, P, P];
  r: number;
}

const line = (x0: number, y0: number, x1: number, y1: number, r: number): Stroke => ({
  pts: [
    [x0, y0],
    [x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3],
    [x0 + ((x1 - x0) * 2) / 3, y0 + ((y1 - y0) * 2) / 3],
    [x1, y1],
  ],
  r,
});
/** An arch of half-width w and height h (negative h curves down, like a smile). */
const arc = (cx: number, cy: number, w: number, h: number, r: number): Stroke => ({
  pts: [
    [cx - w, cy],
    [cx - w * 0.55, cy + h * 1.33],
    [cx + w * 0.55, cy + h * 1.33],
    [cx + w, cy],
  ],
  r,
});
const dot = (r: number, y = 0, x = 0) => line(x, y - 0.002, x, y + 0.002, r);
const NONE = dot(0, 0.13);
const mirror = (s: Stroke): Stroke => ({
  pts: [...s.pts].reverse().map(([x, y]) => [-x, y]) as Stroke['pts'],
  r: s.r,
});

interface Expression {
  /** Left eye, then right eye. A single stroke is mirrored for the right side. */
  eye: Stroke | [Stroke, Stroke];
  brow?: Stroke | [Stroke, Stroke];
  mouth: Stroke;
  shine?: [number, number];
}

export const EXPRESSIONS: Record<Mood, Expression> = {
  neutral: { eye: line(0, -0.055, 0, 0.055, 0.072), mouth: arc(0, 0.01, 0.045, -0.018, 0.018) },
  happy: { eye: arc(0, -0.03, 0.075, 0.07, 0.026), mouth: arc(0, 0.025, 0.07, -0.065, 0.032) },
  surprised: { eye: line(0, -0.065, 0, 0.065, 0.08), mouth: dot(0.05, -0.01), shine: [1, 1] },
  sad: {
    eye: dot(0.066, -0.02),
    brow: line(-0.085, 0.1, 0.06, 0.15, 0.018),
    mouth: arc(0, -0.035, 0.058, 0.04, 0.018),
  },
  sleepy: { eye: arc(0, 0.03, 0.075, -0.05, 0.022), mouth: dot(0.032) },
  squinted: { eye: line(-0.07, 0, 0.07, 0, 0.026), mouth: line(-0.035, 0, 0.035, 0, 0.019) },
  calm: { eye: dot(0.082), mouth: arc(0, 0.015, 0.05, -0.035, 0.017) },
  inspecting: {
    eye: [dot(0.094), line(-0.07, 0, 0.07, 0, 0.025)],
    brow: [NONE, line(-0.08, 0.1, 0.08, 0.135, 0.019)],
    mouth: line(-0.03, -0.01, 0.03, 0.01, 0.019),
    shine: [1, 0],
  },
  confused: {
    eye: [dot(0.074), dot(0.054, 0.02)],
    brow: [line(-0.07, 0.125, 0.07, 0.115, 0.017), arc(0, 0.12, 0.07, 0.04, 0.017)],
    mouth: { pts: [[-0.06, 0], [-0.02, 0.05], [0.02, -0.05], [0.06, 0]], r: 0.017 },
  },
};

const sideOf = (v: Stroke | [Stroke, Stroke] | undefined, side: 0 | 1): Stroke => {
  if (!v) return NONE;
  if (Array.isArray(v)) return v[side];
  return side === 0 ? v : mirror(v);
};

function applyStroke(c: Stroke, tube: Mesh, capA: Mesh, capB: Mesh) {
  const visible = c.r > 0.002;
  tube.visible = capA.visible = capB.visible = visible;
  if (!visible) return;
  const v = c.pts.map(([x, y]) => new Vector3(x, y, 0));
  tube.geometry.dispose();
  tube.geometry = new TubeGeometry(new CubicBezierCurve3(v[0], v[1], v[2], v[3]), 24, c.r, 12, false);
  capA.position.copy(v[0]);
  capB.position.copy(v[3]);
  capA.scale.setScalar(c.r);
  capB.scale.setScalar(c.r);
}

const ready = (...refs: RefObject<Mesh | null>[]) => refs.every((r) => r.current);

/** One morphing stroke. Eases toward its target shape every frame. */
function StrokeMesh({ target, m, speed = 12 }: { target: Stroke; m: Materials; speed?: number }) {
  const tube = useRef<Mesh>(null);
  const capA = useRef<Mesh>(null);
  const capB = useRef<Mesh>(null);
  const cur = useRef<Stroke | null>(null);
  const goal = useRef(target);

  useEffect(() => {
    goal.current = target;
  }, [target]);

  // Build the first shape right away, so still renders (thumbnails, exports) have a face.
  useLayoutEffect(() => {
    if (cur.current || !ready(tube, capA, capB)) return;
    cur.current = { pts: target.pts.map((p) => [...p]) as Stroke['pts'], r: target.r };
    applyStroke(cur.current, tube.current!, capA.current!, capB.current!);
  }, [target]);

  useEffect(() => () => tube.current?.geometry.dispose(), []);

  useFrame((_, dt) => {
    const c = cur.current;
    if (!c || !ready(tube, capA, capB)) return;
    const k = 1 - Math.exp(-speed * Math.min(dt, 0.05));
    const g = goal.current;
    let moved = false;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const d = g.pts[i][j] - c.pts[i][j];
        if (Math.abs(d) > 1e-4) {
          c.pts[i][j] += d * k;
          moved = true;
        }
      }
    }
    if (Math.abs(g.r - c.r) > 1e-4) {
      c.r += (g.r - c.r) * k;
      moved = true;
    }
    if (moved) applyStroke(c, tube.current!, capA.current!, capB.current!);
  });

  return (
    <group scale={[1, 1, 0.5]}>
      <mesh ref={tube} material={m.ink} />
      <mesh ref={capA} material={m.ink}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh ref={capB} material={m.ink}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
    </group>
  );
}

/** The little white catchlight, which fades in and out. */
function Shine({ on, m }: { on: number; m: Materials }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const s = ref.current.scale.x + (on - ref.current.scale.x) * (1 - Math.exp(-12 * Math.min(dt, 0.05)));
    ref.current.scale.setScalar(s);
    ref.current.visible = s > 0.02;
  });
  return (
    <mesh ref={ref} position={[-0.028, 0.045, 0.045]} scale={on} material={m.white}>
      <sphereGeometry args={[0.024, 12, 8]} />
    </mesh>
  );
}

/** Closes the eyes for a moment every few seconds. */
function Blink({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime % 3.6;
    const closing = enabled && t > 3.42 ? Math.sin(((t - 3.42) / 0.18) * Math.PI) : 0;
    ref.current.scale.y = 1 - 0.9 * closing;
  });
  return <group ref={ref}>{children}</group>;
}

/** Noses sit on the face between the eyes and mouth. */
function NoseModel({ nose, m }: { nose: Nose; m: Materials }) {
  switch (nose) {
    case 'button':
      return (
        <mesh scale={[0.065, 0.05, 0.035]} material={m.accent}>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
      );
    case 'triangle':
      return (
        <mesh rotation={[0, 0, Math.PI]} scale={[1, 0.8, 0.5]} material={m.accent}>
          <coneGeometry args={[0.075, 0.11, 32]} />
        </mesh>
      );
    case 'snout':
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.78]} position={[0, 0, 0.06]} material={m.accent}>
            <cylinderGeometry args={[0.27, 0.27, 0.14, 48]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.085 * s, 0, 0.13]} scale={[0.04, 0.06, 0.02]} material={m.ink}>
              <sphereGeometry args={[1, 24, 12]} />
            </mesh>
          ))}
        </group>
      );
    case 'muzzle':
      return (
        <group>
          <mesh scale={[0.38, 0.28, 0.17]} material={m.light}>
            <sphereGeometry args={[1, 48, 24]} />
          </mesh>
          <mesh position={[0, 0.09, 0.15]} scale={[0.1, 0.07, 0.06]} material={m.ink}>
            <sphereGeometry args={[1, 32, 16]} />
          </mesh>
        </group>
      );
    case 'beak':
      return (
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.75]} material={m.accent}>
          <coneGeometry args={[0.13, 0.24, 48]} />
        </mesh>
      );
    default:
      return null;
  }
}

export interface FaceOptions {
  mouth: boolean;
  nose: Nose;
  cheeks: boolean;
  blink: boolean;
  /** Eye offsets and multipliers from the config. */
  eyeY: number;
  eyeSize: number;
  eyeGap: number;
}

export function Face({
  mood,
  layout,
  surface,
  m,
  o,
}: {
  mood: Mood;
  layout: FaceLayout;
  surface: Surface;
  m: Materials;
  o: FaceOptions;
}) {
  const e = EXPRESSIONS[mood];
  const s = layout.scale ?? 1;
  const mouth = useMemo(() => (o.mouth ? e.mouth : { ...e.mouth, r: 0 }), [e, o.mouth]);
  const eyeY = layout.eyeY + o.eyeY;
  const eyeDx = layout.eyeDx * o.eyeGap;
  const noseY = layout.noseY ?? (layout.eyeY + layout.mouthY) / 2 - 0.02;
  const mouthAt: Record<Nose, [number, number]> = {
    none: [layout.mouthY, 0],
    button: [Math.min(layout.mouthY, noseY - 0.14), 0],
    triangle: [Math.min(layout.mouthY, noseY - 0.14), 0],
    snout: [noseY - 0.3, 0],
    muzzle: [noseY - 0.1, 0.12],
    beak: [noseY - 0.25, 0],
  };
  const [mouthY, mouthLift] = mouthAt[o.nose];

  return (
    <group>
      {([0, 1] as const).map((side) => (
        <OnSurface key={side} surface={surface} at={[eyeDx * (side === 0 ? -1 : 1), eyeY]} lift={0.012}>
          <group scale={s * o.eyeSize}>
            <Blink enabled={o.blink}>
              <StrokeMesh target={sideOf(e.eye, side)} m={m} />
              <Shine on={e.shine?.[side] ?? 0} m={m} />
            </Blink>
            <StrokeMesh target={sideOf(e.brow, side)} m={m} />
          </group>
        </OnSurface>
      ))}
      {o.nose !== 'none' && (
        <OnSurface surface={surface} at={[0, noseY]}>
          <NoseModel nose={o.nose} m={m} />
        </OnSurface>
      )}
      <OnSurface surface={surface} at={[0, mouthY]} lift={mouthLift + 0.012}>
        <group scale={s}>
          <StrokeMesh target={mouth} m={m} />
        </group>
      </OnSurface>
      {o.cheeks &&
        ([-1, 1] as const).map((side) => (
          <OnSurface key={side} surface={surface} at={[layout.cheekDx * side, layout.cheekY]}>
            <mesh scale={[0.13, 0.08, 0.02]} material={m.cheek}>
              <sphereGeometry args={[1, 32, 16]} />
            </mesh>
          </OnSurface>
        ))}
    </group>
  );
}
