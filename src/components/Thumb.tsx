'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot, type ReconcilerRoot } from '@react-three/fiber';
import { MASCOT_CAMERA, MASCOT_Y, MascotLights, MascotModel, type MascotConfig } from '@/mascot';

/*
 * Thumbnails are rendered one at a time by a single offscreen renderer and cached
 * as images, so dozens of 3D previews cost one WebGL context.
 */

const PX = 160;
const cache = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();
let root: {
  r: ReconcilerRoot<HTMLCanvasElement>;
  canvas: HTMLCanvasElement;
} | null = null;

/** Resolves once React has committed the scene it is rendered in. */
function Committed({ onCommit }: { onCommit: () => void }) {
  useLayoutEffect(onCommit, [onCommit]);
  return null;
}

async function getRoot() {
  if (root) return root;
  const canvas = document.createElement('canvas');
  const r = createRoot(canvas);
  await r.configure({
    gl: { alpha: true, preserveDrawingBuffer: true, antialias: true },
    camera: MASCOT_CAMERA,
    frameloop: 'never',
    flat: true,
    dpr: 1,
    size: { width: PX, height: PX, top: 0, left: 0 },
  });
  root = { r, canvas };
  return root;
}

function renderThumb(config: MascotConfig, close: boolean): Promise<string> {
  const key = JSON.stringify([config, close]);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const job = queue.then(async () => {
    const cached = cache.get(key);
    if (cached) return cached;
    const { r, canvas } = await getRoot();
    let store!: ReturnType<typeof r.render>;
    await new Promise<void>((resolve) => {
      store = r.render(
        <group key={key}>
          <MascotLights />
          <group position={[0, close ? -0.12 : MASCOT_Y, close ? 2.6 : 0]}>
            <MascotModel {...config} mood={config.mood === 'auto' ? 'happy' : config.mood} />
          </group>
          <Committed onCommit={resolve} />
        </group>,
      );
    });
    const { gl, scene, camera } = store.getState();
    gl.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    if (cache.size > 400) cache.clear();
    cache.set(key, url);
    return url;
  });
  queue = job.catch(() => undefined);
  return job;
}

export function Thumb({ config, close = false }: { config: MascotConfig; close?: boolean }) {
  const key = JSON.stringify([config, close]);
  const [src, setSrc] = useState<{ key: string; url: string } | null>(() => {
    const hit = cache.get(key);
    return hit ? { key, url: hit } : null;
  });

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      renderThumb(config, close).then((url) => live && setSrc({ key, url }));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // config is fully described by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Data URLs from the local renderer, so next/image adds nothing here.
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="thumb" src={src.url} alt="" draggable={false} />
  ) : (
    <span className="thumb thumb-loading" />
  );
}
