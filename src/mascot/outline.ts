import { BackSide, Color, Mesh, ShaderMaterial, Vector3, type BufferGeometry, type Object3D } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * A cartoon outline: each mesh gets a slightly inflated copy of itself, drawn
 * from the inside in a solid color, so only a rim shows around the edges.
 */

const smoothed = new WeakMap<BufferGeometry, BufferGeometry>();

function smoothGeometry(g: BufferGeometry) {
  let s = smoothed.get(g);
  if (!s) {
    // Smooth normals across hard edges so the inflated shell has no cracks.
    s = toCreasedNormals(g.clone(), Math.PI);
    smoothed.set(g, s);
  }
  return s;
}

function outlineMaterial(color: string, thickness: number) {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: { color: { value: new Color(color) }, thickness: { value: thickness } },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Scale of `obj` relative to `root`, averaged over the three axes. */
function relativeScale(obj: Object3D, root: Object3D) {
  const s = new Vector3(1, 1, 1);
  for (let o: Object3D | null = obj; o && o !== root; o = o.parent) s.multiply(o.scale);
  return (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3;
}

/** Adds outlines to every mesh under `targets`. Returns a function that removes them. */
export function addOutlines(targets: Object3D[], root: Object3D, color: string, thickness: number) {
  const added: Mesh[] = [];
  const meshes: Mesh[] = [];
  for (const t of targets) {
    t.traverse((o) => {
      if (o instanceof Mesh && !o.userData.outline && o.visible) meshes.push(o);
    });
  }
  for (const mesh of meshes) {
    const outline = new Mesh(
      smoothGeometry(mesh.geometry),
      outlineMaterial(color, thickness / Math.max(relativeScale(mesh, root), 0.01)),
    );
    outline.userData.outline = true;
    outline.raycast = () => {};
    mesh.add(outline);
    added.push(outline);
  }
  return () => {
    for (const o of added) {
      o.removeFromParent();
      (o.material as ShaderMaterial).dispose();
    }
  };
}
