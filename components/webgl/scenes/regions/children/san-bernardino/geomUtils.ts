import * as THREE from 'three';

/**
 * Lightweight procedural geometry builders for the San Bernardino miniature.
 * Packs architectural primitives (arches, domes, bevelled slabs, extruded
 * outlines, wireframe edges) into merged BufferGeometries to keep draw calls
 * minimal while maximising architectural detail.
 */

export interface TriBuilder {
  pos: number[];
}

export interface LineBuilder {
  pos: number[];
}

export function createTriBuilder(): TriBuilder {
  return { pos: [] };
}

export function createLineBuilder(): LineBuilder {
  return { pos: [] };
}

export function pushTri(
  b: TriBuilder,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
) {
  b.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
}

export function pushQuad(
  b: TriBuilder,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
) {
  b.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  b.pos.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
}

/** Axis-aligned box centred at (cx, cy, cz) with full dimensions (sx, sy, sz). */
export function pushBox(
  b: TriBuilder,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const hx = sx * 0.5;
  const hy = sy * 0.5;
  const hz = sz * 0.5;
  const x0 = cx - hx;
  const x1 = cx + hx;
  const y0 = cy - hy;
  const y1 = cy + hy;
  const z0 = cz - hz;
  const z1 = cz + hz;
  // +Z front
  pushQuad(b, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  // -Z back
  pushQuad(b, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0);
  // +X right
  pushQuad(b, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1);
  // -X left
  pushQuad(b, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0);
  // +Y top
  pushQuad(b, x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0);
  // -Y bottom
  pushQuad(b, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1);
}

/** Hipped roof prism centred at (cx, yBase, cz), rising by height `h`, ridge inset `insetX` and `insetZ`. */
export function pushHippedRoof(
  b: TriBuilder,
  cx: number,
  yBase: number,
  cz: number,
  sx: number,
  sz: number,
  h: number,
  insetX: number,
  insetZ: number,
) {
  const hx = sx * 0.5;
  const hz = sz * 0.5;
  const rx = Math.max(0.01, hx - insetX);
  const rz = Math.max(0.01, hz - insetZ);
  const y1 = yBase + h;

  // Base corners
  const bFL: [number, number, number] = [cx - hx, yBase, cz + hz];
  const bFR: [number, number, number] = [cx + hx, yBase, cz + hz];
  const bBR: [number, number, number] = [cx + hx, yBase, cz - hz];
  const bBL: [number, number, number] = [cx - hx, yBase, cz - hz];

  // Top ridge corners
  const tFL: [number, number, number] = [cx - rx, y1, cz + rz];
  const tFR: [number, number, number] = [cx + rx, y1, cz + rz];
  const tBR: [number, number, number] = [cx + rx, y1, cz - rz];
  const tBL: [number, number, number] = [cx - rx, y1, cz - rz];

  pushQuad(b, ...bFL, ...bFR, ...tFR, ...tFL);
  pushQuad(b, ...bFR, ...bBR, ...tBR, ...tFR);
  pushQuad(b, ...bBR, ...bBL, ...tBL, ...tBR);
  pushQuad(b, ...bBL, ...bFL, ...tFL, ...tBL);
  pushQuad(b, ...tFL, ...tFR, ...tBR, ...tBL);
}

/** Vertical cylinder / prism centred at (cx, cy, cz) with bottom radius r0, top radius r1, height h. */
export function pushFrustum(
  b: TriBuilder,
  cx: number,
  cy: number,
  cz: number,
  r0: number,
  r1: number,
  h: number,
  segs = 16,
  capTop = true,
  capBottom = false,
) {
  const y0 = cy - h * 0.5;
  const y1 = cy + h * 0.5;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    pushQuad(
      b,
      cx + c0 * r0,
      y0,
      cz + s0 * r0,
      cx + c1 * r0,
      y0,
      cz + s1 * r0,
      cx + c1 * r1,
      y1,
      cz + s1 * r1,
      cx + c0 * r1,
      y1,
      cz + s0 * r1,
    );
    if (capTop && r1 > 1e-4) {
      pushTri(b, cx, y1, cz, cx + c1 * r1, y1, cz + s1 * r1, cx + c0 * r1, y1, cz + s0 * r1);
    }
    if (capBottom && r0 > 1e-4) {
      pushTri(b, cx, y0, cz, cx + c0 * r0, y0, cz + s0 * r0, cx + c1 * r0, y0, cz + s1 * r0);
    }
  }
}

/** Hemispherical Mission Revival dome with base at (cx, yBase, cz), radius r, height h. */
export function pushDome(
  b: TriBuilder,
  cx: number,
  yBase: number,
  cz: number,
  r: number,
  h: number,
  lonSegs = 16,
  latSegs = 8,
) {
  for (let j = 0; j < latSegs; j++) {
    const v0 = (j / latSegs) * (Math.PI * 0.5);
    const v1 = ((j + 1) / latSegs) * (Math.PI * 0.5);
    const r0 = Math.cos(v0) * r;
    const y0 = yBase + Math.sin(v0) * h;
    const r1 = Math.cos(v1) * r;
    const y1 = yBase + Math.sin(v1) * h;
    for (let i = 0; i < lonSegs; i++) {
      const a0 = (i / lonSegs) * Math.PI * 2;
      const a1 = ((i + 1) / lonSegs) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      pushQuad(
        b,
        cx + c0 * r0,
        y0,
        cz + s0 * r0,
        cx + c1 * r0,
        y0,
        cz + s1 * r0,
        cx + c1 * r1,
        y1,
        cz + s1 * r1,
        cx + c0 * r1,
        y1,
        cz + s0 * r1,
      );
    }
  }
}

/**
 * Extrude a 2D closed polygon (CCW in XY plane) from z0 to z1 with optional
 * bevel on the front (+Z) face, then transform by an optional Euler/translation.
 */
export function pushExtrudedPolygon(
  b: TriBuilder,
  pts2D: [number, number][],
  z0: number,
  z1: number,
  bevelInset = 0,
  bevelZ = 0,
  transform?: (x: number, y: number, z: number) => [number, number, number],
) {
  const tf = transform ?? ((x: number, y: number, z: number): [number, number, number] => [x, y, z]);
  const shape = new THREE.Shape();
  pts2D.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, z1 - z0),
    bevelEnabled: bevelInset > 0 && bevelZ > 0,
    bevelSize: bevelInset,
    bevelThickness: bevelZ,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geom.translate(0, 0, z0);

  const posAttr = geom.getAttribute('position');
  const indexAttr = geom.getIndex();
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const ia = indexAttr.getX(i);
      const ib = indexAttr.getX(i + 1);
      const ic = indexAttr.getX(i + 2);
      const a = tf(posAttr.getX(ia), posAttr.getY(ia), posAttr.getZ(ia));
      const c = tf(posAttr.getX(ib), posAttr.getY(ib), posAttr.getZ(ib));
      const d = tf(posAttr.getX(ic), posAttr.getY(ic), posAttr.getZ(ic));
      pushTri(b, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      const a = tf(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      const c = tf(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
      const d = tf(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));
      pushTri(b, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    }
  }
  geom.dispose();
}

export function pushLine(
  lb: LineBuilder,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
) {
  lb.pos.push(x0, y0, z0, x1, y1, z1);
}

export function pushPolyline(
  lb: LineBuilder,
  pts: [number, number, number][],
  closed = false,
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    lb.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  if (closed && pts.length > 2) {
    const a = pts[pts.length - 1];
    const b = pts[0];
    lb.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
}

export function pushBoxEdges(
  lb: LineBuilder,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const hx = sx * 0.5;
  const hy = sy * 0.5;
  const hz = sz * 0.5;
  const x0 = cx - hx;
  const x1 = cx + hx;
  const y0 = cy - hy;
  const y1 = cy + hy;
  const z0 = cz - hz;
  const z1 = cz + hz;
  // bottom
  pushLine(lb, x0, y0, z0, x1, y0, z0);
  pushLine(lb, x1, y0, z0, x1, y0, z1);
  pushLine(lb, x1, y0, z1, x0, y0, z1);
  pushLine(lb, x0, y0, z1, x0, y0, z0);
  // top
  pushLine(lb, x0, y1, z0, x1, y1, z0);
  pushLine(lb, x1, y1, z0, x1, y1, z1);
  pushLine(lb, x1, y1, z1, x0, y1, z1);
  pushLine(lb, x0, y1, z1, x0, y1, z0);
  // verticals
  pushLine(lb, x0, y0, z0, x0, y1, z0);
  pushLine(lb, x1, y0, z0, x1, y1, z0);
  pushLine(lb, x1, y0, z1, x1, y1, z1);
  pushLine(lb, x0, y0, z1, x0, y1, z1);
}

/** Rounded Mission arch outline on a Z-facing plane at `z`. */
export function pushArchOutline(
  lb: LineBuilder,
  cx: number,
  yBottom: number,
  z: number,
  width: number,
  springY: number,
  archRadius: number,
  segs = 10,
) {
  const hw = width * 0.5;
  pushLine(lb, cx - hw, yBottom, z, cx - hw, springY, z);
  pushLine(lb, cx + hw, yBottom, z, cx + hw, springY, z);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI;
    const a1 = ((i + 1) / segs) * Math.PI;
    pushLine(
      lb,
      cx + Math.cos(a0) * hw,
      springY + Math.sin(a0) * archRadius,
      z,
      cx + Math.cos(a1) * hw,
      springY + Math.sin(a1) * archRadius,
      z,
    );
  }
}

export function buildTriGeometry(b: TriBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildLineGeometry(lb: LineBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(lb.pos, 3));
  return g;
}
