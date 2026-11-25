'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, GizmoHelper, OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Thumb } from './Thumb';
import {
  ACCESSORIES,
  ANIMALS,
  BACKGROUNDS,
  DEFAULT_CONFIG,
  MASCOT_CAMERA,
  MASCOT_Y,
  MOODS,
  MOTIONS,
  MascotLights,
  MascotModel,
  NO_MOTION,
  PALETTES,
  SHADOW_Y,
  SHAPES,
  inkFor,
  NOSES,
  OUTLINES,
  RANGES,
  speciesDefaults,
  randomConfig,
  sanitizeConfig,
  type MascotConfig,
  type NumberField,
  type Mood,
  type Motion,
  type Species,
} from '@/mascot';

const COLOR_FIELDS = { color: 'Body', accent: 'Accent', ink: 'Face', bgColor: 'Background' } as const;
const MOTION_LABELS: Record<keyof Motion, string> = {
  blink: 'Blink',
  bounce: 'Bounce',
  nod: 'Nod',
  sway: 'Sway',
  follow: 'Follow cursor',
};

function readHash() {
  const p = Object.fromEntries(new URLSearchParams(window.location.hash.slice(1)));
  const motion = { ...NO_MOTION };
  for (const k of MOTIONS) motion[k] = p[k] === '1';
  return { config: sanitizeConfig(p), name: (p.name ?? '').slice(0, 32), motion };
}

function writeHash(config: MascotConfig, name: string, motion: Motion) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(config)) {
    if (v !== DEFAULT_CONFIG[k as keyof MascotConfig]) p.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  if (name) p.set('name', name);
  for (const k of MOTIONS) if (motion[k]) p.set(k, '1');
  const q = p.toString();
  window.history.replaceState(null, '', q ? `#${q}` : window.location.pathname);
}

function reactSnippet(config: MascotConfig, motion: Motion) {
  const props = Object.entries(config)
    .filter(([k, v]) => v !== DEFAULT_CONFIG[k as keyof MascotConfig])
    .map(([k, v]) => (typeof v === 'string' ? `${k}="${v}"` : `${k}={${v}}`));
  const flags = MOTIONS.filter((k) => motion[k]);
  const all = [...props, ...flags];
  return `import { Mascot } from './mascot';\n\n<Mascot ${all.join(' ')}${all.length ? ' ' : ''}size={160} />`;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'mascot';

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (k: number) => (k <= 0 ? resolve() : requestAnimationFrame(() => step(k - 1)));
    step(n);
  });

type Capture = (px: number) => HTMLCanvasElement;

/** Renders the stage at an exact pixel size and copies the result. */
function CaptureBridge({ onReady }: { onReady: (capture: Capture) => void }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    onReady((px) => {
      const { gl, scene, camera, size } = get();
      const ratio = gl.getPixelRatio();
      gl.setPixelRatio(1);
      gl.setSize(px, px, false);
      gl.render(scene, camera);
      const out = document.createElement('canvas');
      out.width = out.height = px;
      out.getContext('2d')!.drawImage(gl.domElement, 0, 0);
      gl.setPixelRatio(ratio);
      gl.setSize(size.width, size.height, false);
      gl.render(scene, camera);
      return out;
    });
  }, [get, onReady]);
  return null;
}

/** Orientation rings that turn with the camera, like a gimbal. */
function OrientationRings() {
  const ring = (color: string, rotation: [number, number, number]) => (
    <mesh rotation={rotation}>
      <torusGeometry args={[1, 0.05, 12, 64]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
  return (
    <group scale={30}>
      {ring('#5b6ee1', [0, 0, 0])}
      {ring('#6cc77a', [0, Math.PI / 2, 0])}
      {ring('#e5645f', [Math.PI / 2, 0, 0])}
      <Billboard>
        <mesh>
          <torusGeometry args={[1.28, 0.05, 12, 64]} />
          <meshBasicMaterial color="#f2c94c" toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

function drawBackground(ctx: CanvasRenderingContext2D, config: MascotConfig, x: number, y: number, s: number) {
  if (config.background === 'none') return;
  ctx.fillStyle = config.bgColor;
  ctx.beginPath();
  if (config.background === 'circle') ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  else ctx.roundRect(x, y, s, s, s * 0.24);
  ctx.fill();
}

function Slider({
  label,
  field,
  config,
  update,
}: {
  label: string;
  field: NumberField;
  config: MascotConfig;
  update: (patch: Partial<MascotConfig>) => void;
}) {
  const [lo, hi] = RANGES[field];
  const v = config[field];
  return (
    <label className="slider">
      <span>{label}</span>
      <input
        type="range"
        min={lo}
        max={hi}
        step={0.01}
        value={v}
        onChange={(e) => update({ [field]: Number(e.target.value) })}
        onDoubleClick={() => update({ [field]: DEFAULT_CONFIG[field] })}
      />
      <output>{field === 'eyeY' ? (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : `${Math.round(v * 100)}%`}</output>
    </label>
  );
}

export function Studio() {
  const [initial] = useState(() =>
    window.location.hash.length > 1
      ? readHash()
      : { config: DEFAULT_CONFIG, name: '', motion: { ...NO_MOTION, blink: true, follow: true } },
  );
  const [config, setConfig] = useState<MascotConfig>(initial.config);
  const [name, setName] = useState(initial.name);
  const [motion, setMotion] = useState<Motion>(initial.motion);
  const [group, setGroup] = useState<'shapes' | 'animals'>(
    (ANIMALS as readonly string[]).includes(initial.config.species) ? 'animals' : 'shapes',
  );
  const [paused, setPaused] = useState(false);
  const [moodOverride, setMoodOverride] = useState<Mood | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const capture = useRef<Capture | null>(null);
  const model = useRef<Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => writeHash(config, name, motion), [config, name, motion]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (patch: Partial<MascotConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const pickSpecies = (species: Species) => {
    update(speciesDefaults(species));
  };

  /** Pauses motion, waits for the scene to settle, then runs fn. */
  async function still<T>(fn: () => T | Promise<T>) {
    setBusy(true);
    setPaused(true);
    await nextFrames(3);
    try {
      return await fn();
    } finally {
      setPaused(false);
      setMoodOverride(null);
      setBusy(false);
    }
  }

  const exportPng = (px: number, withBackground: boolean) =>
    still(() => {
      const shot = capture.current!(px);
      const out = document.createElement('canvas');
      out.width = out.height = px;
      const ctx = out.getContext('2d')!;
      if (withBackground) drawBackground(ctx, config, 0, 0, px);
      ctx.drawImage(shot, 0, 0);
      out.toBlob(
        (b) => b && download(b, `${slug(name)}-${px}${withBackground ? '' : '-transparent'}.png`),
        'image/png',
      );
    });

  const exportSheet = () =>
    still(async () => {
      const cell = 320;
      const label = 44;
      const head = 72;
      const cols = 3;
      const out = document.createElement('canvas');
      out.width = cell * cols;
      out.height = head + (cell + label) * Math.ceil(MOODS.length / cols);
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillStyle = '#1f1a24';
      ctx.textAlign = 'center';
      ctx.font = '600 28px system-ui, sans-serif';
      ctx.fillText(name || 'Mascot', out.width / 2, 46);
      ctx.font = '500 18px system-ui, sans-serif';
      for (let i = 0; i < MOODS.length; i++) {
        setMoodOverride(MOODS[i]);
        await nextFrames(36); // let the face finish morphing
        const x = (i % cols) * cell;
        const y = head + Math.floor(i / cols) * (cell + label);
        drawBackground(ctx, config, x + 24, y + 12, cell - 48);
        ctx.drawImage(capture.current!(cell), x, y);
        ctx.fillStyle = '#4b4556';
        ctx.fillText(MOODS[i], x + cell / 2, y + cell + 26);
      }
      out.toBlob((b) => b && download(b, `${slug(name)}-expressions.png`), 'image/png');
    });

  const exportGlb = () =>
    still(
      () =>
        new Promise<void>((resolve, reject) => {
          // Outlines use a custom shader that glTF can't store, so leave them out.
          const outlines: { visible: boolean }[] = [];
          model.current!.traverse((o) => {
            if (o.userData.outline) {
              o.visible = false;
              outlines.push(o);
            }
          });
          new GLTFExporter().parse(
            model.current!,
            (result) => {
              outlines.forEach((o) => (o.visible = true));
              download(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }), `${slug(name)}.glb`);
              resolve();
            },
            (err) => {
              outlines.forEach((o) => (o.visible = true));
              reject(err);
            },
            { binary: true },
          );
        }),
    );

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(msg);
    } catch {
      setToast('Your browser blocked clipboard access.');
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed.');
      const next = sanitizeConfig(data.config);
      setConfig(next);
      setGroup((ANIMALS as readonly string[]).includes(next.species) ? 'animals' : 'shapes');
      if (data.name) setName(String(data.name).slice(0, 32));
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  const liveMotion = paused ? NO_MOTION : motion;
  const speciesList = group === 'shapes' ? SHAPES : ANIMALS;

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden />
          <h1>mascotkit</h1>
        </div>
        <p>Every app deserves a mascot. Build yours in 3D in a minute.</p>
      </header>

      <main className="layout">
        <section className="stage-col" aria-label="Preview">
          <div className="stage">
            {config.background !== 'none' && (
              <div className={`stage-bg ${config.background}`} style={{ background: config.bgColor }} />
            )}
            <Canvas
              camera={MASCOT_CAMERA}
              dpr={[1, 2]}
              gl={{ alpha: true, antialias: true }}
              flat
              className="stage-canvas"
            >
              <MascotLights />
              <group position={[0, MASCOT_Y, 0]}>
                <MascotModel ref={model} {...config} {...liveMotion} mood={moodOverride ?? config.mood} />
              </group>
              <ContactShadows position={[0, SHADOW_Y, 0]} opacity={0.4} scale={4} blur={2.4} far={2} />
              <OrbitControls
                ref={controls}
                enableZoom={false}
                enablePan={false}
                enableDamping
                minPolarAngle={Math.PI / 2 - 0.7}
                maxPolarAngle={Math.PI / 2 + 0.35}
              />
              <GizmoHelper alignment="top-right" margin={[64, 64]}>
                <OrientationRings />
              </GizmoHelper>
              <CaptureBridge onReady={(fn) => (capture.current = fn)} />
            </Canvas>
            <p className="stage-hint">Drag to turn it around</p>
            <button
              className="reset"
              aria-label="Back to front view"
              title="Back to front view"
              onClick={() => controls.current?.reset()}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
          </div>

          <div className="dock">
            <div className="motion" role="group" aria-label="Animation">
              {MOTIONS.map((k) => (
                <button key={k} aria-pressed={motion[k]} onClick={() => setMotion((m) => ({ ...m, [k]: !m[k] }))}>
                  {MOTION_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel" aria-label="Customize">
          <input
            className="name"
            value={name}
            maxLength={32}
            placeholder="Name your mascot"
            aria-label="Mascot name"
            onChange={(e) => setName(e.target.value)}
          />

          <fieldset>
            <legend>Character</legend>
            <div className="segmented tabs" role="group" aria-label="Character type">
              {(['shapes', 'animals'] as const).map((g) => (
                <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
            <div className="chips">
              {speciesList.map((s) => (
                <button key={s} className="chip" aria-pressed={config.species === s} onClick={() => pickSpecies(s)}>
                  <Thumb config={{ ...config, ...speciesDefaults(s), mood: 'happy', accessory: 'none' }} />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Expression</legend>
            <div className="chips">
              {(['auto', ...MOODS] as const).map((m) => (
                <button key={m} className="chip" aria-pressed={config.mood === m} onClick={() => update({ mood: m })}>
                  <Thumb config={{ ...config, mood: m, accessory: 'none' }} close />
                  <span>{m}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Face</legend>
            <div className="segmented" role="group" aria-label="Mouth">
              <button aria-pressed={!config.mouth} onClick={() => update({ mouth: false })}>
                No mouth
              </button>
              <button aria-pressed={config.mouth} onClick={() => update({ mouth: true })}>
                Mouth
              </button>
            </div>
            <div className="segmented" role="group" aria-label="Nose">
              {NOSES.map((n) => (
                <button key={n} aria-pressed={config.nose === n} onClick={() => update({ nose: n })}>
                  {n === 'none' ? 'No nose' : n}
                </button>
              ))}
            </div>
            <Slider label="Eye height" field="eyeY" config={config} update={update} />
            <Slider label="Eye size" field="eyeSize" config={config} update={update} />
            <Slider label="Eye gap" field="eyeGap" config={config} update={update} />
            <label className="check">
              <input type="checkbox" checked={config.cheeks} onChange={(e) => update({ cheeks: e.target.checked })} />
              Blush cheeks
            </label>
          </fieldset>

          <fieldset>
            <legend>Body</legend>
            <Slider label="Scale" field="scale" config={config} update={update} />
            <Slider label="Width" field="width" config={config} update={update} />
            <Slider label="Height" field="height" config={config} update={update} />
            <Slider label="Depth" field="depth" config={config} update={update} />
            <div className="segmented" role="group" aria-label="Outline">
              {OUTLINES.map((o) => (
                <button key={o} aria-pressed={config.outline === o} onClick={() => update({ outline: o })}>
                  {o === 'none' ? 'No outline' : `${o} outline`}
                </button>
              ))}
            </div>
            <button
              className="link"
              onClick={() =>
                update({ scale: 1, width: 1, height: 1, depth: 1, eyeY: 0, eyeSize: 1, eyeGap: 1, outline: 'none' })
              }
            >
              Reset sizes
            </button>
          </fieldset>

          <fieldset>
            <legend>Accessory</legend>
            <div className="chips">
              {ACCESSORIES.map((a) => (
                <button
                  key={a}
                  className="chip"
                  aria-pressed={config.accessory === a}
                  onClick={() => update({ accessory: a })}
                >
                  <Thumb config={{ ...config, accessory: a, mood: 'happy' }} />
                  <span>{a}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Colors</legend>
            <div className="palettes">
              {PALETTES.map((p) => (
                <button
                  key={p.name}
                  className="swatch"
                  title={p.name}
                  aria-label={`${p.name} palette`}
                  style={{ background: `linear-gradient(135deg, ${p.color} 50%, ${p.accent} 50%)` }}
                  onClick={() => update({ color: p.color, accent: p.accent, bgColor: p.bgColor, ink: inkFor(p.color) })}
                />
              ))}
            </div>
            <div className="colors">
              {(Object.keys(COLOR_FIELDS) as (keyof typeof COLOR_FIELDS)[]).map((k) => (
                <label key={k}>
                  <input type="color" value={config[k]} onChange={(e) => update({ [k]: e.target.value })} />
                  {COLOR_FIELDS[k]}
                </label>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Background">
              {BACKGROUNDS.map((b) => (
                <button key={b} aria-pressed={config.background === b} onClick={() => update({ background: b })}>
                  {b === 'none' ? 'No background' : b}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Export</legend>
            <div className="actions">
              <button className="primary" onClick={() => setConfig(randomConfig())}>
                Surprise me
              </button>
              <button disabled={busy} onClick={() => exportPng(1024, true)}>
                PNG
              </button>
              <button disabled={busy} onClick={() => exportPng(1024, false)}>
                Transparent PNG
              </button>
              <button disabled={busy} onClick={exportSheet}>
                Expression sheet
              </button>
              <button disabled={busy} onClick={exportGlb}>
                3D model (.glb)
              </button>
              <button onClick={() => copy(reactSnippet(config, motion), 'React code copied')}>Copy React</button>
              <button onClick={() => copy(window.location.href, 'Link copied')}>Copy link</button>
            </div>
            <p className="note">
              PNGs use the current camera angle, so turn the mascot first if you want a different pose.
            </p>
          </fieldset>

          <form
            className="ai"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <label htmlFor="prompt">Describe it and let AI build it</label>
            <textarea
              id="prompt"
              rows={2}
              maxLength={300}
              value={prompt}
              placeholder="A sleepy purple bunny for a meditation app"
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button className="primary" disabled={generating || !prompt.trim()}>
              {generating ? 'Thinking...' : 'Generate'}
            </button>
          </form>

          <p className="toast" role="status" aria-live="polite">
            {toast}
          </p>
        </section>
      </main>

      <footer>Open source under the MIT license. Mascots you make are yours.</footer>
    </>
  );
}
