import type { ReactNode } from 'react';
import type { Accessory } from './config';
import type { Materials } from './materials';

/** Each accessory is drawn with its base at y = 0, then lifted to the top of the head. */
export const ACCESSORY_MODELS: Record<Accessory, (m: Materials) => ReactNode> = {
  none: () => null,
  sprout: (m) => (
    <group>
      <mesh position={[0, 0.12, 0]} material={m.accent}>
        <cylinderGeometry args={[0.025, 0.03, 0.3, 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.15 * s, 0.3, 0]} rotation={[0, 0, 0.5 * s]} scale={[0.17, 0.07, 0.1]} material={m.accent}>
          <sphereGeometry args={[1, 24, 12]} />
        </mesh>
      ))}
    </group>
  ),
  antenna: (m) => (
    <group>
      <mesh position={[0, 0.18, 0]} material={m.ink}>
        <cylinderGeometry args={[0.022, 0.022, 0.38, 12]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={m.accent}>
        <sphereGeometry args={[0.1, 24, 16]} />
      </mesh>
    </group>
  ),
  crown: (m) => (
    <group position={[0, -0.04, 0]} rotation={[0, 0, -0.12]}>
      <mesh position={[0, 0.07, 0]} material={m.gold}>
        <cylinderGeometry args={[0.3, 0.27, 0.15, 40, 1, true]} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * 0.29, 0.22, Math.cos(a) * 0.29]}>
            <mesh material={m.gold}>
              <coneGeometry args={[0.07, 0.18, 16]} />
            </mesh>
            <mesh position={[0, 0.1, 0]} material={m.accent}>
              <sphereGeometry args={[0.03, 12, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  ),
  cap: (m) => (
    <group position={[0, -0.32, 0]}>
      <mesh material={m.accent}>
        <sphereGeometry args={[0.64, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 0.02, 0.5]} scale={[1, 1, 0.75]} material={m.accent}>
        <cylinderGeometry args={[0.42, 0.42, 0.05, 40]} />
      </mesh>
      <mesh position={[0, 0.64, 0]} material={m.light}>
        <sphereGeometry args={[0.06, 16, 8]} />
      </mesh>
    </group>
  ),
  bow: (m) => (
    <group position={[0.32, 0.02, 0.12]} rotation={[0, 0, -0.3]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.13 * s, 0, 0]} rotation={[0, 0, (Math.PI / 2) * s]} material={m.accent}>
          <coneGeometry args={[0.12, 0.24, 24]} />
        </mesh>
      ))}
      <mesh material={m.accent}>
        <sphereGeometry args={[0.065, 16, 12]} />
      </mesh>
    </group>
  ),
  coin: (m) => (
    <group position={[0, 0.16, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.gold}>
        <cylinderGeometry args={[0.22, 0.22, 0.07, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.037]} material={m.gold}>
        <torusGeometry args={[0.15, 0.015, 8, 40]} />
      </mesh>
    </group>
  ),
  halo: (m) => (
    <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2 - 0.25, 0, 0]} material={m.gold}>
      <torusGeometry args={[0.36, 0.045, 16, 48]} />
    </mesh>
  ),
};
