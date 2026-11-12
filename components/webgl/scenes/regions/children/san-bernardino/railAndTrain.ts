import * as THREE from 'three';
import { buildPathLut, type PathLut } from '../../lib-a/pathLut';
import {
  buildLineGeometry,
  buildTriGeometry,
  createLineBuilder,
  createTriBuilder,
  pushBox,
  pushBoxEdges,
  pushFrustum,
  pushLine,
  pushPolyline,
  pushQuad,
} from './geomUtils';

/**
 * The diorama plinth, the winding BNSF / Santa Fe rail line through the depot
 * yard and Cajon Pass trestle, the Historic Route 66 highway ribbon, and the
 * crafted miniature locomotive + double-stack intermodal container cars.
 */

export interface RailAndTrainData {
  railLut: PathLut;
  highwayLut: PathLut;
  plinthGeo: THREE.BufferGeometry;
  plinthLinesGeo: THREE.BufferGeometry;
  roadbedGeo: THREE.BufferGeometry;
  railsAndTrestleGeo: THREE.BufferGeometry;
  highwayDashGeo: THREE.BufferGeometry;
  locoBodyGeo: THREE.BufferGeometry;
  locoGlowGeo: THREE.BufferGeometry;
  locoLinesGeo: THREE.BufferGeometry;
  carLowerGeo: THREE.BufferGeometry;
  carUpperGeo: THREE.BufferGeometry;
  carLinesGeo: THREE.BufferGeometry;
  dispose: () => void;
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _side2 = new THREE.Vector3();

export function buildRailAndTrain(): RailAndTrainData {
  // ---------------------------------------------------------------------------
  // 1. ARCHITECTURAL VITRINE PLINTH BASE
  // ---------------------------------------------------------------------------
  const plinthTri = createTriBuilder();
  const plinthLines = createLineBuilder();

  const plinthYTop = -0.68;
  const plinthH = 0.14;
  const rx = 2.82;
  const rz = 2.24;
  const segs = 48;

  const topRing: [number, number, number][] = [];
  const midRing: [number, number, number][] = [];
  const botRing: [number, number, number][] = [];

  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    topRing.push([c * (rx - 0.06), plinthYTop, s * (rz - 0.05)]);
    midRing.push([c * rx, plinthYTop - 0.035, s * rz]);
    botRing.push([c * (rx + 0.04), plinthYTop - plinthH, s * (rz + 0.03)]);
  }

  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    // Top flat deck triangle fan
    plinthTri.pos.push(
      0,
      plinthYTop,
      -0.1,
      topRing[j][0],
      topRing[j][1],
      topRing[j][2],
      topRing[i][0],
      topRing[i][1],
      topRing[i][2],
    );
    // Chamfer bevel
    pushQuad(plinthTri, ...topRing[i], ...topRing[j], ...midRing[j], ...midRing[i]);
    // Lower skirt wall
    pushQuad(plinthTri, ...midRing[i], ...midRing[j], ...botRing[j], ...botRing[i]);

    // Precision compass degree ticks around the bevel rim
    if (i % 2 === 0) {
      pushLine(plinthLines, ...topRing[i], ...midRing[i]);
    }
  }
  pushPolyline(plinthLines, topRing, true);
  pushPolyline(plinthLines, midRing, true);
  pushPolyline(plinthLines, botRing, true);

  // Subtle architectural survey grid lines across the valley terrace
  for (let gx = -2.0; gx <= 2.0; gx += 0.5) {
    const zSpan = Math.sqrt(Math.max(0, 1 - (gx / (rx - 0.15)) ** 2)) * (rz - 0.15);
    pushLine(plinthLines, gx, plinthYTop + 0.002, -zSpan, gx, plinthYTop + 0.002, zSpan);
  }
  for (let gz = -1.5; gz <= 1.5; gz += 0.5) {
    const xSpan = Math.sqrt(Math.max(0, 1 - (gz / (rz - 0.15)) ** 2)) * (rx - 0.15);
    pushLine(plinthLines, -xSpan, plinthYTop + 0.002, gz, xSpan, plinthYTop + 0.002, gz);
  }

  // ---------------------------------------------------------------------------
  // 2. THE CAJON PASS & SANTA FE DEPOT RAIL CORRIDOR
  // Sweeps from the West Yard, straight along the Santa Fe Depot platform,
  // banks around the eastern horseshoe curve, crosses the high steel-truss
  // viaduct trestle, and climbs through Cajon Pass beneath the Arrowhead.
  // ---------------------------------------------------------------------------
  const railCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-2.52, -0.635, 0.68),
      new THREE.Vector3(-1.45, -0.635, 0.34),
      new THREE.Vector3(-0.35, -0.625, 0.25),
      new THREE.Vector3(0.75, -0.59, 0.24),
      new THREE.Vector3(1.68, -0.46, 0.05),
      new THREE.Vector3(1.94, -0.28, -0.42),
      new THREE.Vector3(1.38, -0.08, -0.82),
      new THREE.Vector3(0.35, 0.08, -0.88),
      new THREE.Vector3(-0.58, 0.22, -0.96),
      new THREE.Vector3(-1.12, 0.36, -1.28),
      new THREE.Vector3(-0.96, 0.49, -1.78),
      new THREE.Vector3(-0.62, 0.58, -2.22),
    ],
    false,
    'centripetal',
  );
  const railLut = buildPathLut(railCurve, 900);

  const roadbedTri = createTriBuilder();
  const railsAndTrestle = createLineBuilder();

  const nRail = 360;
  const gauge = 0.054;
  const bedHalfW = 0.095;

  for (let i = 0; i < nRail; i++) {
    const u0 = i / nRail;
    const u1 = (i + 1) / nRail;
    railLut.sample(u0, _p, _t);
    _side.crossVectors(_t, _up).normalize();
    railLut.sample(u1, _p2, _t2);
    _side2.crossVectors(_t2, _up).normalize();

    // Raised ballast roadbed ribbon
    pushQuad(
      roadbedTri,
      _p.x - _side.x * bedHalfW,
      _p.y - 0.012,
      _p.z - _side.z * bedHalfW,
      _p.x + _side.x * bedHalfW,
      _p.y - 0.012,
      _p.z + _side.z * bedHalfW,
      _p2.x + _side2.x * bedHalfW,
      _p2.y - 0.012,
      _p2.z + _side2.z * bedHalfW,
      _p2.x - _side2.x * bedHalfW,
      _p2.y - 0.012,
      _p2.z - _side2.z * bedHalfW,
    );

    // Twin steel rails + outer viaduct deck parapet lines
    for (const s of [-1, 1]) {
      pushLine(
        railsAndTrestle,
        _p.x + _side.x * s * gauge,
        _p.y + 0.004,
        _p.z + _side.z * s * gauge,
        _p2.x + _side2.x * s * gauge,
        _p2.y + 0.004,
        _p2.z + _side2.z * s * gauge,
      );
      if (_p.y - plinthYTop > 0.16) {
        pushLine(
          railsAndTrestle,
          _p.x + _side.x * s * bedHalfW * 1.15,
          _p.y - 0.025,
          _p.z + _side.z * s * bedHalfW * 1.15,
          _p2.x + _side2.x * s * bedHalfW * 1.15,
          _p2.y - 0.025,
          _p2.z + _side2.z * s * bedHalfW * 1.15,
        );
      }
    }

    // Engineered Cajon Pass steel-truss trestle bents where elevated above the valley floor
    if (i % 10 === 0 && _p.y - plinthYTop > 0.14) {
      const topY = _p.y - 0.02;
      const botY = plinthYTop;
      const h = topY - botY;
      const topW = 0.075;
      const botW = 0.075 + h * 0.16;

      const tL: [number, number, number] = [_p.x - _side.x * topW, topY, _p.z - _side.z * topW];
      const tR: [number, number, number] = [_p.x + _side.x * topW, topY, _p.z + _side.z * topW];
      const bL: [number, number, number] = [_p.x - _side.x * botW, botY, _p.z - _side.z * botW];
      const bR: [number, number, number] = [_p.x + _side.x * botW, botY, _p.z + _side.z * botW];

      pushLine(railsAndTrestle, ...tL, ...bL);
      pushLine(railsAndTrestle, ...tR, ...bR);
      pushLine(railsAndTrestle, ...tL, ...tR);

      if (h > 0.32) {
        const mY = (topY + botY) * 0.5;
        const mW = (topW + botW) * 0.5;
        const mL: [number, number, number] = [_p.x - _side.x * mW, mY, _p.z - _side.z * mW];
        const mR: [number, number, number] = [_p.x + _side.x * mW, mY, _p.z + _side.z * mW];
        pushLine(railsAndTrestle, ...mL, ...mR);
        // X-bracing
        pushLine(railsAndTrestle, ...tL, ...mR);
        pushLine(railsAndTrestle, ...tR, ...mL);
        pushLine(railsAndTrestle, ...mL, ...bR);
        pushLine(railsAndTrestle, ...mR, ...bL);
      } else {
        pushLine(railsAndTrestle, ...tL, ...bR);
        pushLine(railsAndTrestle, ...tR, ...bL);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. HISTORIC U.S. ROUTE 66 HIGHWAY RIBBON (Foothill Blvd / Cajon Blvd)
  // Parallels the rail corridor in the foreground, passing the Route 66 shield
  // and giving Cato a scenic promenade path!
  // ---------------------------------------------------------------------------
  const highwayCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-2.32, -0.668, 1.26),
      new THREE.Vector3(-1.18, -0.668, 0.94),
      new THREE.Vector3(0.05, -0.668, 0.84),
      new THREE.Vector3(1.05, -0.668, 0.78),
      new THREE.Vector3(1.92, -0.668, 0.52),
    ],
    false,
    'centripetal',
  );
  const highwayLut = buildPathLut(highwayCurve, 400);
  const highwayDash = createLineBuilder();

  const nHwy = 120;
  const hwyHalfW = 0.145;
  for (let i = 0; i < nHwy; i++) {
    const u0 = i / nHwy;
    const u1 = (i + 1) / nHwy;
    highwayLut.sample(u0, _p, _t);
    _side.crossVectors(_t, _up).normalize();
    highwayLut.sample(u1, _p2, _t2);
    _side2.crossVectors(_t2, _up).normalize();

    pushQuad(
      roadbedTri,
      _p.x - _side.x * hwyHalfW,
      _p.y,
      _p.z - _side.z * hwyHalfW,
      _p.x + _side.x * hwyHalfW,
      _p.y,
      _p.z + _side.z * hwyHalfW,
      _p2.x + _side2.x * hwyHalfW,
      _p2.y,
      _p2.z + _side2.z * hwyHalfW,
      _p2.x - _side2.x * hwyHalfW,
      _p2.y,
      _p2.z - _side2.z * hwyHalfW,
    );

    // Curb edge lines
    for (const s of [-1, 1]) {
      pushLine(
        highwayDash,
        _p.x + _side.x * s * hwyHalfW,
        _p.y + 0.003,
        _p.z + _side.z * s * hwyHalfW,
        _p2.x + _side2.x * s * hwyHalfW,
        _p2.y + 0.003,
        _p2.z + _side2.z * s * hwyHalfW,
      );
    }
    // Dashed centerline along Route 66
    if (i % 3 !== 2) {
      pushLine(highwayDash, _p.x, _p.y + 0.004, _p.z, _p2.x, _p2.y + 0.004, _p2.z);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. CRAFTED MINIATURE FREIGHT LOCOMOTIVE (nose points along -Z)
  // ---------------------------------------------------------------------------
  const locoBody = createTriBuilder();
  const locoGlow = createTriBuilder();
  const locoLines = createLineBuilder();

  // Chassis frame & walkways (z in [-0.21, +0.21], y base at 0 = rail head)
  pushBox(locoBody, 0, 0.032, 0, 0.165, 0.022, 0.42);
  pushBoxEdges(locoLines, 0, 0.032, 0, 0.165, 0.022, 0.42);

  // Two bogie trucks & underslung fuel tank
  pushBox(locoBody, 0, 0.015, -0.125, 0.14, 0.024, 0.095);
  pushBox(locoBody, 0, 0.015, 0.125, 0.14, 0.024, 0.095);
  pushBox(locoBody, 0, 0.018, 0, 0.13, 0.022, 0.11);

  // Front snowplow pilot at -Z nose
  pushBox(locoBody, 0, 0.018, -0.212, 0.15, 0.024, 0.018);

  // Short low nose hood at front (-Z)
  pushBox(locoBody, 0, 0.068, -0.175, 0.145, 0.052, 0.068);
  pushBoxEdges(locoLines, 0, 0.068, -0.175, 0.145, 0.052, 0.068);

  // Wide-vision safety cab (higher & full width)
  pushBox(locoBody, 0, 0.096, -0.105, 0.158, 0.105, 0.088);
  pushBoxEdges(locoLines, 0, 0.096, -0.105, 0.158, 0.105, 0.088);

  // Glowing cab windshields & numberboards + twin nose headlights + ditch lights
  pushBox(locoGlow, -0.04, 0.118, -0.151, 0.048, 0.028, 0.008);
  pushBox(locoGlow, 0.04, 0.118, -0.151, 0.048, 0.028, 0.008);
  // High-intensity nose headlight + lower ditch lights
  pushBox(locoGlow, 0, 0.084, -0.212, 0.032, 0.022, 0.012);
  pushBox(locoGlow, -0.052, 0.038, -0.212, 0.02, 0.018, 0.01);
  pushBox(locoGlow, 0.052, 0.038, -0.212, 0.02, 0.018, 0.01);

  // Long engine hood + flared rear radiator section
  pushBox(locoBody, 0, 0.092, 0.062, 0.132, 0.098, 0.255);
  pushBoxEdges(locoLines, 0, 0.092, 0.062, 0.132, 0.098, 0.255);
  // Flared radiator wings at rear (+Z)
  pushBox(locoBody, 0, 0.118, 0.142, 0.156, 0.038, 0.092);
  pushBoxEdges(locoLines, 0, 0.118, 0.142, 0.156, 0.038, 0.092);

  // Roof cooling fans
  for (const fz of [0.02, 0.09, 0.15]) {
    pushFrustum(locoBody, 0, 0.145, fz, 0.028, 0.028, 0.012, 10, true, false);
  }

  // ---------------------------------------------------------------------------
  // 5. DOUBLE-STACK INTERMODAL WELL CAR + CORRUGATED SHIPPING CONTAINERS
  // ---------------------------------------------------------------------------
  const carLower = createTriBuilder();
  const carUpper = createTriBuilder();
  const carLines = createLineBuilder();

  // Articulated well-car frame & bogie trucks
  pushBox(carLower, 0, 0.015, -0.14, 0.135, 0.022, 0.075);
  pushBox(carLower, 0, 0.015, 0.14, 0.135, 0.022, 0.075);
  pushBox(carLower, 0, 0.024, 0, 0.148, 0.016, 0.365);

  // Bottom 40ft container sitting in the well
  pushBox(carLower, 0, 0.062, 0, 0.138, 0.068, 0.315);
  pushBoxEdges(carLines, 0, 0.062, 0, 0.138, 0.068, 0.315);

  // Top 53ft container stacked above (slightly longer overhang, iconic double-stack silhouette!)
  pushBox(carUpper, 0, 0.132, 0, 0.142, 0.072, 0.365);
  pushBoxEdges(carLines, 0, 0.132, 0, 0.142, 0.072, 0.365);

  // Container corrugation rib lines along the sides
  for (let cz = -0.14; cz <= 0.14; cz += 0.04) {
    for (const sx of [-0.072, 0.072]) {
      pushLine(carLines, sx, 0.098, cz, sx, 0.166, cz);
      if (Math.abs(cz) <= 0.12) {
        pushLine(carLines, sx * 0.97, 0.03, cz, sx * 0.97, 0.094, cz);
      }
    }
  }

  const plinthGeo = buildTriGeometry(plinthTri);
  const plinthLinesGeo = buildLineGeometry(plinthLines);
  const roadbedGeo = buildTriGeometry(roadbedTri);
  const railsAndTrestleGeo = buildLineGeometry(railsAndTrestle);
  const highwayDashGeo = buildLineGeometry(highwayDash);
  const locoBodyGeo = buildTriGeometry(locoBody);
  const locoGlowGeo = buildTriGeometry(locoGlow);
  const locoLinesGeo = buildLineGeometry(locoLines);
  const carLowerGeo = buildTriGeometry(carLower);
  const carUpperGeo = buildTriGeometry(carUpper);
  const carLinesGeo = buildLineGeometry(carLines);

  return {
    railLut,
    highwayLut,
    plinthGeo,
    plinthLinesGeo,
    roadbedGeo,
    railsAndTrestleGeo,
    highwayDashGeo,
    locoBodyGeo,
    locoGlowGeo,
    locoLinesGeo,
    carLowerGeo,
    carUpperGeo,
    carLinesGeo,
    dispose() {
      plinthGeo.dispose();
      plinthLinesGeo.dispose();
      roadbedGeo.dispose();
      railsAndTrestleGeo.dispose();
      highwayDashGeo.dispose();
      locoBodyGeo.dispose();
      locoGlowGeo.dispose();
      locoLinesGeo.dispose();
      carLowerGeo.dispose();
      carUpperGeo.dispose();
      carLinesGeo.dispose();
    },
  };
}
