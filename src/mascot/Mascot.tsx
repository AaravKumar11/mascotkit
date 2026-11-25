'use client';

import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { DEFAULT_CONFIG } from './config';
import { MascotModel, type MascotModelProps } from './MascotModel';

/** Soft, even light that keeps colors true: no reflections or glare. */
export function MascotLights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c9c3d6', 1.9]} />
      <directionalLight position={[1.5, 3, 5]} intensity={1.3} />
      <directionalLight position={[-3, 1, -4]} intensity={0.5} />
    </>
  );
}

/** Camera and placement that frame a mascot with room for accessories and bouncing. */
export const MASCOT_CAMERA = { position: [0, 0.1, 6.6] as [number, number, number], fov: 32 };
export const MASCOT_Y = -0.28;
export const SHADOW_Y = -1.56;

export type MascotProps = MascotModelProps & {
  /** Width and height in px or any CSS size. Defaults to 200. */
  size?: number | string;
  /** Show a soft shadow under the mascot. Defaults to true. */
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** A self-contained 3D mascot: canvas, lights and model in one component. */
export function Mascot({ size = 200, shadow = true, className, style, title = 'Mascot', ...props }: MascotProps) {
  const background = props.background ?? DEFAULT_CONFIG.background;
  const bgColor = props.bgColor ?? DEFAULT_CONFIG.bgColor;
  return (
    <div
      role="img"
      aria-label={title}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: background === 'circle' ? '50%' : background === 'squircle' ? '24%' : undefined,
        background: background === 'none' ? undefined : bgColor,
        ...style,
      }}
    >
      <Canvas camera={MASCOT_CAMERA} dpr={[1, 2]} flat>
        <MascotLights />
        <group position={[0, MASCOT_Y, 0]}>
          <MascotModel {...props} />
        </group>
        {shadow && <ContactShadows position={[0, SHADOW_Y, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />}
      </Canvas>
    </div>
  );
}
