'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { ACCESSORY_MODELS } from './accessories';
import { DEFAULT_CONFIG, MOODS, type MascotConfig, type Mood, type Motion } from './config';
import { Face } from './face';
import { createMaterials, disposeMaterials } from './materials';
import { addOutlines } from './outline';
import { SHAPES, StretchContext } from './shapes';

export type MascotModelProps = Partial<MascotConfig> &
  Partial<Motion> & {
    ref?: Ref<Group>;
  };

const AUTO_MOODS: Mood[] = ['happy', 'calm', 'surprised', 'inspecting', 'happy', 'sleepy', 'confused', 'neutral'];

function useAutoMood(enabled: boolean): Mood {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setI((n) => (n + 1) % AUTO_MOODS.length), 2200);
    return () => clearInterval(t);
  }, [enabled]);
  return AUTO_MOODS[i];
}

/** Pointer position in -1..1 relative to the canvas, tracked across the whole window. */
function usePointer(enabled: boolean) {
  const gl = useThree((s) => s.gl);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!enabled) {
      pointer.current = { x: 0, y: 0 };
      return;
    }
    const onMove = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      pointer.current = {
        x: MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5),
        y: MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.5, 1.5),
      };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled, gl]);
  return pointer;
}

/**
 * The 3D mascot as a scene object. Drop it into any react-three-fiber <Canvas>.
 * For a ready-made canvas with lights, use <Mascot /> instead.
 */
export function MascotModel({
  ref,
  blink = false,
  bounce = false,
  nod = false,
  sway = false,
  follow = false,
  ...rest
}: MascotModelProps) {
  const c = { ...DEFAULT_CONFIG, ...rest };
  const autoMood = useAutoMood(c.mood === 'auto');
  const mood: Mood = c.mood === 'auto' ? autoMood : MOODS.includes(c.mood) ? c.mood : 'happy';
  const shape = SHAPES[c.species] ?? SHAPES.blob;

  const { color, accent, ink } = c;
  const m = useMemo(() => createMaterials(color, accent, ink), [color, accent, ink]);
  useEffect(() => () => disposeMaterials(m), [m]);

  const motion = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const accRef = useRef<Group>(null);
  const { species, accessory, outline, scale, width, height, depth } = c;

  // Outlines are added after the meshes mount (layout effect, so still renders include them).
  useLayoutEffect(() => {
    if (outline === 'none' || !bodyRef.current || !accRef.current || !motion.current) return;
    return addOutlines([bodyRef.current, accRef.current], motion.current, ink, outline === 'thin' ? 0.022 : 0.045);
  }, [outline, ink, species, accessory, scale, width, height, depth, m]);
  const pointer = usePointer(follow);
  const look = useRef({ x: 0, y: 0 });

  useFrame(({ clock }) => {
    const g = motion.current;
    if (!g) return;
    const t = clock.elapsedTime;
    let y = 0;
    let sx = 1;
    let sy = 1 + Math.sin(t * 2) * 0.012;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    if (bounce) {
      const h = Math.abs(Math.sin(t * Math.PI * 1.4));
      const squash = Math.max(0, 1 - h * 5);
      y += h * 0.32;
      sy *= 1 - 0.12 * squash;
      sx *= 1 + 0.08 * squash;
    }
    if (nod) rx += Math.sin(t * 3.2) * 0.2;
    if (sway) {
      rz += Math.sin(t * 1.8) * 0.12;
      ry += Math.sin(t * 0.9) * 0.3;
    }
    look.current.x = MathUtils.lerp(look.current.x, pointer.current.x, 0.08);
    look.current.y = MathUtils.lerp(look.current.y, pointer.current.y, 0.08);
    ry += look.current.x * 0.55;
    rx += look.current.y * 0.35;

    g.position.y = y;
    g.scale.set(sx, sy, sx);
    g.rotation.set(rx, ry, rz);
  });

  return (
    <group ref={ref}>
      <group ref={motion}>
        <group scale={scale}>
          <group ref={bodyRef} scale={[width, height, depth]}>
            <shape.Body m={m} surface={shape.surface} />
          </group>
          <StretchContext.Provider value={[width, height, depth]}>
            <Face
              mood={mood}
              layout={shape.face}
              surface={shape.surface}
              m={m}
              o={{
                mouth: c.mouth,
                nose: c.nose,
                cheeks: c.cheeks,
                blink,
                eyeY: c.eyeY,
                eyeSize: c.eyeSize,
                eyeGap: c.eyeGap,
              }}
            />
          </StretchContext.Provider>
          <group ref={accRef} position={[0, shape.top * height, 0]}>
            {ACCESSORY_MODELS[accessory]?.(m)}
          </group>
        </group>
      </group>
    </group>
  );
}
