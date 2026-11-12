import * as THREE from 'three';

/**
 * Procedural geometries for the Cato Glass Sorting & Dispatch Rail Miniature.
 * Everything is built once in useMemo and disposed on unmount.
 */

export const STATION_X = [-3.05, -1.55, -0.05, 1.35, 2.75] as const;
export const RAIL_Y = -0.32;

/**
 * Sleek open-frame gantry arch: slender side piers and a bevelled top bridge
 * with a wide open window so the conveyor belt, rollers, and parcels remain
 * clearly visible from any 3/4 angle.
 */
export function makePortalArchGeometry(
  width: number,
  height: number,
  depth: number,
  tunnelW: number,
  tunnelH: number,
) {
  const hw = width / 2;
  const r = Math.min(0.1, width * 0.1);
  const shape = new THREE.Shape();

  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, height - r);
  shape.quadraticCurveTo(-hw, height, -hw + r, height);
  shape.lineTo(hw - r, height);
  shape.quadraticCurveTo(hw, height, hw, height - r);
  shape.lineTo(hw, 0);

  const thw = tunnelW / 2;
  const tr = Math.min(0.07, tunnelW * 0.08);
  shape.lineTo(thw, 0);
  shape.lineTo(thw, tunnelH - tr);
  shape.quadraticCurveTo(thw, tunnelH, thw - tr, tunnelH);
  shape.lineTo(-thw + tr, tunnelH);
  shape.quadraticCurveTo(-thw, tunnelH, -thw, tunnelH - tr);
  shape.lineTo(-thw, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.016,
    bevelSegments: 3,
    curveSegments: 12,
  });
  // Rotate so the arch straddles the X-axis conveyor (tunnel runs along X, width along Z)
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sample a point on one of the 3 outfeed branches for x >= 1.35:
 * branch 0 = Front Auto Rail (z -> +0.62)
 * branch 1 = Center Auto Rail (z -> 0)
 * branch 2 = Back Escalation Spur (z -> -0.84, y rises +0.34)
 */
export function sampleBranchPoint(
  u: number, // 0..1 from diverter (x=1.35) to outfeed end (x=3.45)
  branch: 0 | 1 | 2,
  out: THREE.Vector3,
) {
  const t = Math.max(0, Math.min(1, u));
  const ease = t * t * (3 - 2 * t);
  const x = 1.35 + t * 2.1;
  if (branch === 0) {
    out.set(x, RAIL_Y + 0.06, ease * 0.62);
  } else if (branch === 1) {
    out.set(x, RAIL_Y + 0.06, 0);
  } else {
    const xSpur = 1.35 + t * 1.85;
    out.set(xSpur, RAIL_Y + 0.06 + ease * 0.34, -ease * 0.84);
  }
}

/**
 * Merged architectural line-segments geometry for the plinth calibration grid,
 * main conveyor rails, cross-ties, rotary turntable rings, and the 3 diverging output tracks.
 */
export function makeRailNetworkLines(): THREE.BufferGeometry {
  const pts: number[] = [];
  const seg = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ) => {
    pts.push(x1, y1, z1, x2, y2, z2);
  };

  const baseY = RAIL_Y - 0.11;
  const px0 = -3.85;
  const px1 = 3.85;
  const pz0 = -1.34;
  const pz1 = 1.22;

  // Plinth perimeter frame
  seg(px0, baseY, pz0, px1, baseY, pz0);
  seg(px1, baseY, pz0, px1, baseY, pz1);
  seg(px1, baseY, pz1, px0, baseY, pz1);
  seg(px0, baseY, pz1, px0, baseY, pz0);

  // Calibration ticks along the front & back plinth edges
  for (let i = 0; i <= 32; i++) {
    const x = px0 + ((px1 - px0) * i) / 32;
    const tick = i % 4 === 0 ? 0.11 : 0.045;
    seg(x, baseY + 0.002, pz1, x, baseY + 0.002, pz1 - tick);
    seg(x, baseY + 0.002, pz0, x, baseY + 0.002, pz0 + tick);
  }

  // Main trunk parallel rails from x = -3.55 to diverter x = 1.35
  const ry = RAIL_Y + 0.055;
  const gauge = 0.25;
  seg(-3.55, ry, -gauge, 1.35, ry, -gauge);
  seg(-3.55, ry, gauge, 1.35, ry, gauge);

  // Cross-ties on main trunk
  for (let x = -3.45; x <= 1.25; x += 0.2) {
    seg(x, ry - 0.004, -gauge - 0.05, x, ry - 0.004, gauge + 0.05);
  }

  // Concentric calibration circle around Station 04 Rotary Diverter (x = 1.35)
  const divSegs = 32;
  const divR = 0.58;
  for (let i = 0; i < divSegs; i++) {
    const a0 = (i / divSegs) * Math.PI * 2;
    const a1 = ((i + 1) / divSegs) * Math.PI * 2;
    seg(
      1.35 + Math.cos(a0) * divR,
      ry - 0.02,
      Math.sin(a0) * divR,
      1.35 + Math.cos(a1) * divR,
      ry - 0.02,
      Math.sin(a1) * divR,
    );
  }

  // Diverging 3-branch tracks from x = 1.35 outwards
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const steps = 18;
  const branchGauge = 0.16;

  ([0, 1, 2] as const).forEach((branch) => {
    for (let i = 0; i < steps; i++) {
      const u0 = i / steps;
      const u1 = (i + 1) / steps;
      sampleBranchPoint(u0, branch, p0);
      sampleBranchPoint(u1, branch, p1);
      seg(p0.x, p0.y, p0.z - branchGauge, p1.x, p1.y, p1.z - branchGauge);
      seg(p0.x, p0.y, p0.z + branchGauge, p1.x, p1.y, p1.z + branchGauge);
      if (i % 2 === 0) {
        seg(
          p0.x,
          p0.y - 0.003,
          p0.z - branchGauge - 0.035,
          p0.x,
          p0.y - 0.003,
          p0.z + branchGauge + 0.035,
        );
      }
    }
  });

  // Vertical datum drop-lines under each of the 5 stations
  for (let s = 0; s < STATION_X.length; s++) {
    const sx = STATION_X[s];
    seg(sx, baseY + 0.004, pz0 + 0.1, sx, baseY + 0.004, pz1 - 0.1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

/**
 * Optical scan reticle inside Station 02 (Extract): corner brackets, horizontal
 * laser scan lines, and vertical measurement ticks.
 */
export function makeScannerReticleGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const seg = (y1: number, z1: number, y2: number, z2: number) => {
    pts.push(0, y1, z1, 0, y2, z2);
  };

  const w = 0.36;
  const y0 = 0.08;
  const y1 = 0.68;
  const c = 0.12;

  // Four corner brackets
  seg(y0, -w, y0 + c, -w);
  seg(y0, -w, y0, -w + c);

  seg(y1, -w, y1 - c, -w);
  seg(y1, -w, y1, -w + c);

  seg(y1, w, y1 - c, w);
  seg(y1, w, y1, w - c);

  seg(y0, w, y0 + c, w);
  seg(y0, w, y0, w - c);

  // Center scan lines & fan rays from top lens (y=0.92, z=0) down to bed (y=0.08)
  const ym = (y0 + y1) * 0.5;
  seg(ym, -w * 0.85, ym, w * 0.85);
  seg(0.92, 0, y0, -w * 0.9);
  seg(0.92, 0, y0, -w * 0.45);
  seg(0.92, 0, y0, 0);
  seg(0.92, 0, y0, w * 0.45);
  seg(0.92, 0, y0, w * 0.9);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}
