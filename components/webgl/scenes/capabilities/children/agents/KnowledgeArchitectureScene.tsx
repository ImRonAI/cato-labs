'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three-stdlib';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import { GlassMaterial } from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import {
  clamp01,
  easeOutBack,
  easeOutCubic,
  lerp,
  readDwell,
  rng,
  type DwellBeats,
} from './signature';

/* ------------------------------------------------------------------ */
/*  KnowledgeArchitectureScene — "The Knowledge Lattice".             */
/*                                                                    */
/*  Fifty-four refractive glass document tablets begin as an          */
/*  unstructured cloud of drifting shards around a dormant sapphire   */
/*  query core. Across the 280vh `signature` dwell (0 → 1):           */
/*    Beat 1 (0.00 → 0.38): Taxonomy — chaotic shards sort and snap   */
/*      into a three-tier hexagonal refractive lattice + datum rings. */
/*    Beat 2 (0.32 → 0.70): Vector Index — hairline azure edges and   */
/*      six semantic anchor hubs wire the tiers into a unified graph. */
/*    Beat 3 (0.64 → 1.00): Grounded Retrieval — an axial electric-   */
/*      blue retrieval beam ignites through the core and fires        */
/*      light pulses along multi-hop vector paths, flaring matched    */
/*      shards on arrival.                                            */
/*                                                                    */
/*  Continues choreographing camera + stage through `feature`,        */
/*  `detail`, `faq`, and `cta`. Hotspot 'knowledge-query' rides the   */
/*  central query core. Zero allocations in useFrame; reduced motion  */
/*  renders the fully crystallized, illuminated lattice as a still.   */
/* ------------------------------------------------------------------ */

const TIERS = 3;
const PER_TIER = 18;
const SHARD_TOTAL = TIERS * PER_TIER; // 54
const ANCHOR_TOTAL = 6; // 2 semantic hubs per tier
const TIER_Y = [-1.12, 0.0, 1.12] as const;
const TIER_R = [2.15, 1.78, 1.42] as const;

interface RetrievalPath {
  pts: Float32Array;
  lens: Float32Array;
  total: number;
  targetShard: number;
  targetAnchor: number;
  offset: number;
}

const LATTICE = (() => {
  const rand = rng(409);

  const cloudPos = new Float32Array(SHARD_TOTAL * 3);
  const cloudQuat = new Float32Array(SHARD_TOTAL * 4);
  const latPos = new Float32Array(SHARD_TOTAL * 3);
  const latQuat = new Float32Array(SHARD_TOTAL * 4);
  const shardScale = new Float32Array(SHARD_TOTAL * 3);
  const shardTier = new Uint8Array(SHARD_TOTAL);
  const shardOrder = new Float32Array(SHARD_TOTAL);
  const shardPhase = new Float32Array(SHARD_TOTAL);
  const shardTint: string[] = [];

  const qTmp = new THREE.Quaternion();
  const eTmp = new THREE.Euler();

  const TINTS = ['#dce4ff', '#b9c9ff', '#93a9ff', '#e8eeff', '#7d97ff'];

  for (let tier = 0; tier < TIERS; tier++) {
    const y = TIER_Y[tier];
    const r = TIER_R[tier];
    for (let k = 0; k < PER_TIER; k++) {
      const i = tier * PER_TIER + k;
      const angle = (k / PER_TIER) * Math.PI * 2 + tier * (Math.PI / PER_TIER);
      /* slight hexagonal facet modulation */
      const hexMod = 1 + 0.055 * Math.cos(angle * 6);
      const lx = Math.cos(angle) * r * hexMod;
      const lz = Math.sin(angle) * r * hexMod;
      latPos[i * 3] = lx;
      latPos[i * 3 + 1] = y + (k % 2 === 0 ? 0.04 : -0.04);
      latPos[i * 3 + 2] = lz;

      /* tablet faces the central retrieval axis cleanly */
      eTmp.set(0, -angle + Math.PI / 2, 0);
      qTmp.setFromEuler(eTmp);
      latQuat[i * 4] = qTmp.x;
      latQuat[i * 4 + 1] = qTmp.y;
      latQuat[i * 4 + 2] = qTmp.z;
      latQuat[i * 4 + 3] = qTmp.w;

      /* unstructured cloud pose: wide spherical scatter + arbitrary tumble */
      const u = rand() * Math.PI * 2;
      const v = Math.acos(rand() * 2 - 1);
      const cr = 2.55 + rand() * 2.15;
      cloudPos[i * 3] = Math.sin(v) * Math.cos(u) * cr;
      cloudPos[i * 3 + 1] = Math.cos(v) * cr * 0.72;
      cloudPos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * cr - 0.35;

      eTmp.set(
        (rand() - 0.5) * Math.PI * 1.6,
        (rand() - 0.5) * Math.PI * 2.0,
        (rand() - 0.5) * Math.PI * 1.4,
      );
      qTmp.setFromEuler(eTmp);
      cloudQuat[i * 4] = qTmp.x;
      cloudQuat[i * 4 + 1] = qTmp.y;
      cloudQuat[i * 4 + 2] = qTmp.z;
      cloudQuat[i * 4 + 3] = qTmp.w;

      /* crisp vertical document-tablet proportions */
      const h = 0.28 + rand() * 0.14;
      shardScale[i * 3] = 0.19 + rand() * 0.05;
      shardScale[i * 3 + 1] = h;
      shardScale[i * 3 + 2] = 0.048;

      shardTier[i] = tier;
      shardOrder[i] = tier * 0.24 + (k / PER_TIER) * 0.22 + rand() * 0.06;
      shardPhase[i] = rand() * Math.PI * 2;
      shardTint.push(TINTS[(tier * 2 + k) % TINTS.length]);
    }
  }

  /* 6 semantic anchor hubs — 2 opposing inner hubs per tier */
  const anchorCloud = new Float32Array(ANCHOR_TOTAL * 3);
  const anchorLat = new Float32Array(ANCHOR_TOTAL * 3);
  for (let tier = 0; tier < TIERS; tier++) {
    for (let side = 0; side < 2; side++) {
      const a = tier * 2 + side;
      const ang = side * Math.PI + tier * (Math.PI / 3) + 0.35;
      const ar = TIER_R[tier] * 0.52;
      anchorLat[a * 3] = Math.cos(ang) * ar;
      anchorLat[a * 3 + 1] = TIER_Y[tier];
      anchorLat[a * 3 + 2] = Math.sin(ang) * ar;

      anchorCloud[a * 3] = Math.cos(ang + 1.1) * (ar + 1.5);
      anchorCloud[a * 3 + 1] = TIER_Y[tier] * 1.45 + (rand() - 0.5) * 0.9;
      anchorCloud[a * 3 + 2] = Math.sin(ang + 1.1) * (ar + 1.5);
    }
  }

  /* ordered vector graph edges so setDrawRange reveals tier-by-tier */
  const segs: number[] = [];
  const pushSeg = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ) => {
    segs.push(ax, ay, az, bx, by, bz);
  };

  for (let tier = 0; tier < TIERS; tier++) {
    /* intra-tier ring edges */
    for (let k = 0; k < PER_TIER; k++) {
      const i = tier * PER_TIER + k;
      const j = tier * PER_TIER + ((k + 1) % PER_TIER);
      pushSeg(
        latPos[i * 3],
        latPos[i * 3 + 1],
        latPos[i * 3 + 2],
        latPos[j * 3],
        latPos[j * 3 + 1],
        latPos[j * 3 + 2],
      );
    }
    /* anchor spokes to core & to nearest shards */
    for (let side = 0; side < 2; side++) {
      const a = tier * 2 + side;
      const ax = anchorLat[a * 3];
      const ay = anchorLat[a * 3 + 1];
      const az = anchorLat[a * 3 + 2];
      /* core to anchor */
      pushSeg(0, 0, 0, ax, ay, az);
      /* anchor to 5 nearest shards in the same tier */
      const base = tier * PER_TIER + (side === 0 ? 0 : 9);
      for (let m = -2; m <= 2; m++) {
        const k = (base + m + PER_TIER) % PER_TIER;
        const si = tier * PER_TIER + k;
        pushSeg(
          ax,
          ay,
          az,
          latPos[si * 3],
          latPos[si * 3 + 1],
          latPos[si * 3 + 2],
        );
      }
    }
    /* cross-tier vertical links */
    if (tier < TIERS - 1) {
      for (let k = 0; k < PER_TIER; k += 3) {
        const i = tier * PER_TIER + k;
        const j = (tier + 1) * PER_TIER + k;
        pushSeg(
          latPos[i * 3],
          latPos[i * 3 + 1],
          latPos[i * 3 + 2],
          latPos[j * 3],
          latPos[j * 3 + 1],
          latPos[j * 3 + 2],
        );
      }
    }
  }

  const edgeVertices = new Float32Array(segs);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeVertices, 3));
  const totalEdgeVerts = edgeVertices.length / 3;

  /* 6 retrieval paths: core (0,0,0) → axial tier node → anchor → target shard */
  const paths: RetrievalPath[] = [];
  for (let a = 0; a < ANCHOR_TOTAL; a++) {
    const tier = Math.floor(a / 2);
    const side = a % 2;
    const targetK = (side === 0 ? 2 : 11) + tier;
    const shardIdx = tier * PER_TIER + (targetK % PER_TIER);
    const w0 = new THREE.Vector3(0, 0, 0);
    const w1 = new THREE.Vector3(0, TIER_Y[tier], 0);
    const w2 = new THREE.Vector3(
      anchorLat[a * 3],
      anchorLat[a * 3 + 1],
      anchorLat[a * 3 + 2],
    );
    const w3 = new THREE.Vector3(
      latPos[shardIdx * 3],
      latPos[shardIdx * 3 + 1],
      latPos[shardIdx * 3 + 2],
    );
    const wps = [w0, w1, w2, w3];
    const pts = new Float32Array(wps.length * 3);
    const lens = new Float32Array(wps.length);
    let acc = 0;
    for (let w = 0; w < wps.length; w++) {
      pts[w * 3] = wps[w].x;
      pts[w * 3 + 1] = wps[w].y;
      pts[w * 3 + 2] = wps[w].z;
      if (w > 0) acc += wps[w].distanceTo(wps[w - 1]);
      lens[w] = acc;
    }
    paths.push({
      pts,
      lens,
      total: acc,
      targetShard: shardIdx,
      targetAnchor: a,
      offset: a * 0.13,
    });
  }

  return {
    cloudPos,
    cloudQuat,
    latPos,
    latQuat,
    shardScale,
    shardTier,
    shardOrder,
    shardPhase,
    shardTint,
    anchorCloud,
    anchorLat,
    edgeGeo,
    totalEdgeVerts,
    paths,
  };
})();

const PULSE_COUNT = LATTICE.paths.length;

/* module-level scratch — zero allocations inside useFrame */
const _beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _look = new THREE.Vector3(0, 0, 0);
const _camTarget = new THREE.Vector3();
const _shardFlare = new Float32Array(SHARD_TOTAL);
const _anchorFlare = new Float32Array(ANCHOR_TOTAL);

function samplePath(path: RetrievalPath, u: number, out: THREE.Vector3) {
  const d = clamp01(u) * path.total;
  const lens = path.lens;
  let i = 1;
  while (i < lens.length - 1 && lens[i] < d) i++;
  const l0 = lens[i - 1];
  const l1 = lens[i];
  const f = l1 > l0 ? (d - l0) / (l1 - l0) : 0;
  const a = (i - 1) * 3;
  const b = i * 3;
  const pts = path.pts;
  out.set(
    pts[a] + (pts[b] - pts[a]) * f,
    pts[a + 1] + (pts[b + 1] - pts[a + 1]) * f,
    pts[a + 2] + (pts[b + 2] - pts[a + 2]) * f,
  );
}

export default function KnowledgeArchitectureScene() {
  const q = useQuality();
  const report = useHotspotReporter('knowledge-query');

  const stageRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const shardsRef = useRef<THREE.InstancedMesh>(null);
  const anchorsRef = useRef<THREE.InstancedMesh>(null);
  const pulsesRef = useRef<THREE.InstancedMesh>(null);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const lensRingRef = useRef<THREE.Mesh>(null);
  const startAt = useRef<number | null>(null);

  const shardGeo = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 3, 0.14),
    [],
  );
  const pulseColor = useMemo(() => new THREE.Color(0.85, 1.15, 2.9), []);
  const beamColor = useMemo(() => new THREE.Color(0.45, 0.72, 2.5), []);

  useEffect(
    () => () => {
      shardGeo.dispose();
    },
    [shardGeo],
  );

  /* apply per-shard subtle blue-spectrum tints once on mount */
  useEffect(() => {
    const inst = shardsRef.current;
    if (!inst) return;
    for (let i = 0; i < SHARD_TOTAL; i++) {
      inst.setColorAt(i, _c.set(LATTICE.shardTint[i]));
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    /* mount-relative intro from light */
    const introRaw = anim ? clamp01(el / 1.55) : 1;
    const intro = easeOutCubic(introRaw);

    /* scroll choreography — hero → signature (280vh dwell) → feature → detail → faq → cta */
    const hero = smooth(sectionRange(getSectionProgress('hero'), 0.05, 0.95));
    const sig = readDwell('signature', _beats);
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.04, 0.92));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const faq = smooth(sectionRange(getSectionProgress('faq'), 0.05, 0.9));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.85));

    /* play progress: 0 in hero, scrubs 0→1 across pinned signature dwell, stays 1 below */
    const play = anim ? Math.max(sig.play, sig.leave > 0 ? 1 : 0) : 1;

    /* Beat 2: vector graph edge draw */
    const edgeDraw = anim ? smooth(sectionRange(play, 0.28, 0.72)) : 1;
    const drawVerts = Math.floor((edgeDraw * LATTICE.totalEdgeVerts) / 2) * 2;
    LATTICE.edgeGeo.setDrawRange(0, drawVerts);
    if (lineMatRef.current) {
      lineMatRef.current.opacity = intro * (0.08 + 0.36 * edgeDraw);
    }

    /* Beat 3: axial retrieval beam + multi-hop retrieval pulses */
    const beamIgnite = anim ? smooth(sectionRange(play, 0.62, 0.94)) : 0.88;
    _shardFlare.fill(0);
    _anchorFlare.fill(0);
    let coreFlash = 0;

    const pInst = pulsesRef.current;
    for (let i = 0; i < PULSE_COUNT; i++) {
      const path = LATTICE.paths[i];
      let u = -1;
      if (anim && play > 0.6) {
        if (sig.leave < 0.05) {
          /* scrub-driven retrieval wave during the pinned dwell */
          u = (play - 0.62 - path.offset * 0.45) / 0.3;
        } else {
          /* post-dwell autonomous retrieval cadence across feature/detail */
          const cyc = ((el * 0.42 + i * 0.38) % 2.2);
          u = cyc <= 1.0 ? cyc : -1;
        }
      }

      if (u >= 0 && u <= 1.0) {
        const fu = smooth(clamp01(u));
        if (pInst) {
          samplePath(path, fu, _p);
          const sc = Math.max(Math.sin(fu * Math.PI) * (0.85 + 0.35 * det), 0.0001);
          _m.compose(_p, _qA.identity(), _s.setScalar(sc));
          pInst.setMatrixAt(i, _m);
        }
        if (fu < 0.2) coreFlash = Math.max(coreFlash, (0.2 - fu) / 0.2);
        if (fu > 0.45 && fu < 0.82) {
          _anchorFlare[path.targetAnchor] = Math.max(
            _anchorFlare[path.targetAnchor],
            Math.sin(((fu - 0.45) / 0.37) * Math.PI),
          );
        }
        if (fu > 0.78) {
          const hit = (fu - 0.78) / 0.22;
          _shardFlare[path.targetShard] = Math.max(
            _shardFlare[path.targetShard],
            Math.sin(hit * Math.PI),
          );
        }
      } else if (pInst) {
        _m.compose(_p.set(0, -100, 0), _qA.identity(), _s.setScalar(0.0001));
        pInst.setMatrixAt(i, _m);
      }

      /* sustain subtle target glow at the end of the dwell */
      if (beamIgnite > 0.85) {
        _shardFlare[path.targetShard] = Math.max(
          _shardFlare[path.targetShard],
          (beamIgnite - 0.85) * 2.2,
        );
      }
    }
    if (pInst) pInst.instanceMatrix.needsUpdate = true;

    /* update 54 document shards: chaotic cloud → 3-tier hexagonal lattice */
    const sInst = shardsRef.current;
    if (sInst) {
      for (let i = 0; i < SHARD_TOTAL; i++) {
        const ord = LATTICE.shardOrder[i];
        const rawLock = anim ? clamp01((play - ord * 0.75) / 0.36) : 1;
        const lock = rawLock <= 0 ? 0 : rawLock >= 1 ? 1 : easeOutBack(rawLock, 1.05);
        const chaosAmt = 1 - clamp01(rawLock);

        const ph = LATTICE.shardPhase[i];
        const cx =
          LATTICE.cloudPos[i * 3] +
          (anim ? Math.sin(el * 0.55 + ph) * 0.18 * chaosAmt : 0);
        const cy =
          LATTICE.cloudPos[i * 3 + 1] +
          (anim ? Math.cos(el * 0.48 + ph * 1.3) * 0.16 * chaosAmt : 0);
        const cz =
          LATTICE.cloudPos[i * 3 + 2] +
          (anim ? Math.sin(el * 0.41 + ph * 0.7) * 0.15 * chaosAmt : 0);

        const lx = LATTICE.latPos[i * 3];
        const ly =
          LATTICE.latPos[i * 3 + 1] +
          (anim ? Math.sin(el * 0.9 + ph) * 0.018 * clamp01(rawLock) : 0);
        const lz = LATTICE.latPos[i * 3 + 2];

        _p.set(lerp(cx, lx, lock), lerp(cy, ly, lock), lerp(cz, lz, lock));

        _qA.set(
          LATTICE.cloudQuat[i * 4],
          LATTICE.cloudQuat[i * 4 + 1],
          LATTICE.cloudQuat[i * 4 + 2],
          LATTICE.cloudQuat[i * 4 + 3],
        );
        _qB.set(
          LATTICE.latQuat[i * 4],
          LATTICE.latQuat[i * 4 + 1],
          LATTICE.latQuat[i * 4 + 2],
          LATTICE.latQuat[i * 4 + 3],
        );
        _qA.slerp(_qB, smooth(rawLock));

        const appear = smooth(clamp01((introRaw - LATTICE.shardTier[i] * 0.08) / 0.68));
        const flare = 1 + _shardFlare[i] * 0.48;
        _s.set(
          Math.max(LATTICE.shardScale[i * 3] * appear * flare, 0.0001),
          Math.max(LATTICE.shardScale[i * 3 + 1] * appear * flare, 0.0001),
          Math.max(LATTICE.shardScale[i * 3 + 2] * appear * (1 + _shardFlare[i] * 0.9), 0.0001),
        );
        _m.compose(_p, _qA, _s);
        sInst.setMatrixAt(i, _m);
      }
      sInst.instanceMatrix.needsUpdate = true;
    }

    /* update 6 semantic anchor octahedra */
    const aInst = anchorsRef.current;
    if (aInst) {
      const hubLock = anim ? smooth(sectionRange(play, 0.24, 0.6)) : 1;
      for (let a = 0; a < ANCHOR_TOTAL; a++) {
        _p.set(
          lerp(LATTICE.anchorCloud[a * 3], LATTICE.anchorLat[a * 3], hubLock),
          lerp(LATTICE.anchorCloud[a * 3 + 1], LATTICE.anchorLat[a * 3 + 1], hubLock),
          lerp(LATTICE.anchorCloud[a * 3 + 2], LATTICE.anchorLat[a * 3 + 2], hubLock),
        );
        _qA.setFromAxisAngle(
          THREE.Object3D.DEFAULT_UP,
          (anim ? el * 0.5 : 0.4) + a * 1.05,
        );
        const sc =
          Math.max(intro * (0.11 + 0.04 * hubLock), 0.0001) *
          (1 + _anchorFlare[a] * 0.55);
        _m.compose(_p, _qA, _s.setScalar(sc));
        aInst.setMatrixAt(a, _m);
      }
      aInst.instanceMatrix.needsUpdate = true;
    }

    /* 3 horizontal refractive datum rings expand into place per tier */
    for (let tier = 0; tier < TIERS; tier++) {
      const ring = ringRefs.current[tier];
      if (!ring) continue;
      const rAppear = anim
        ? easeOutBack(clamp01((play - (0.12 + tier * 0.09)) / 0.28), 0.9)
        : 1;
      ring.scale.setScalar(Math.max(rAppear * intro, 0.0001));
    }

    /* axial retrieval beam */
    if (beamRef.current) {
      beamRef.current.scale.set(
        1 + coreFlash * 0.35,
        Math.max(beamIgnite * intro, 0.0001),
        1 + coreFlash * 0.35,
      );
    }
    if (beamMatRef.current) {
      beamMatRef.current.opacity = beamIgnite * (0.42 + coreFlash * 0.38) * intro;
    }

    /* central sapphire query core + dispersive halo lens */
    if (coreRef.current) {
      const pulse = 1 + coreFlash * 0.16 + beamIgnite * 0.08;
      coreRef.current.scale.setScalar(Math.max(intro * pulse, 0.0001));
      report(
        coreRef.current,
        state.camera,
        0.48 + beamIgnite * 0.32 + coreFlash * 0.25 + det * 0.12,
      );
    }
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity =
        0.45 + beamIgnite * 0.75 + coreFlash * 1.15 + det * 0.35;
    }
    if (lensRingRef.current) {
      if (anim) {
        lensRingRef.current.rotation.x = Math.PI / 2 + Math.sin(el * 0.55) * 0.26;
        lensRingRef.current.rotation.y = el * 0.38;
      } else {
        lensRingRef.current.rotation.set(Math.PI / 2 + 0.18, 0.4, 0);
      }
      lensRingRef.current.scale.setScalar(Math.max(intro * (0.88 + 0.12 * beamIgnite), 0.0001));
    }

    /* stage framing & slow spin */
    const inDwell = sig.arrive * (1 - sig.leave);
    if (stageRef.current) {
      const targetX = q.compact
        ? 0
        : lerp(1.35, 0.38, sig.arrive) +
          sig.leave * 0.85 -
          det * 0.35 +
          cta * 0.25;
      const targetY = (1 - intro) * -0.85 + (q.compact ? -0.15 : 0.05) + cta * 0.18;
      if (anim) {
        stageRef.current.position.x += (targetX - stageRef.current.position.x) * 0.06;
        stageRef.current.position.y += (targetY - stageRef.current.position.y) * 0.06;
      } else {
        stageRef.current.position.set(q.compact ? 0 : 0.55, 0.05, 0);
      }
    }

    if (spinRef.current) {
      if (anim) {
        const spinRate = 0.085 + inDwell * 0.055 - det * 0.04;
        spinRef.current.rotation.y += dt * spinRate;
        const targetRx = -pointer.y * 0.08 + inDwell * 0.06;
        const targetRz = pointer.x * 0.05;
        spinRef.current.rotation.x += (targetRx - spinRef.current.rotation.x) * 0.05;
        spinRef.current.rotation.z += (targetRz - spinRef.current.rotation.z) * 0.05;
      } else {
        spinRef.current.rotation.set(0.08, 0.52, 0);
      }
    }

    /* camera choreography across hero → signature → feature → detail → faq/cta */
    const baseZ = q.compact ? 9.8 : 8.2;
    let cx = anim ? Math.sin(el * 0.07) * 0.22 : 0.18;
    let cy = 0.72 + (1 - intro) * 0.45;
    let cz = baseZ + (1 - intro) * 1.6 - hero * 0.35;

    /* dwell: compose an authoritative elevated three-quarter view */
    cx += inDwell * -0.35;
    cy += inDwell * 0.52;
    cz -= inDwell * 0.95;

    /* feature: glide closer to inspect the crystallized middle tier */
    cx += feat * -0.85 * (1 - det);
    cy += feat * -0.18 * (1 - det);
    cz -= feat * 1.45 * (1 - faq);

    /* detail: descend & focus into the central sapphire query core */
    cx += det * 0.65 * (1 - faq);
    cy += det * -0.32 * (1 - faq);
    cz -= det * 0.75 * (1 - faq);

    /* faq & cta: rise into a calm gallery overview */
    cy += (faq * 0.45 + cta * 0.55);
    cz += (faq * 0.9 + cta * 1.15);

    if (anim) {
      cx += pointer.x * 0.28;
      cy += pointer.y * 0.18;
    }

    const lx = q.compact ? 0 : lerp(0.55, 0.28, inDwell) + feat * 0.25 - det * 0.15;
    const ly = 0.04 + feat * 0.08 - det * 0.06;
    const lz = 0;

    _camTarget.set(cx, cy, cz);
    if (anim) {
      state.camera.position.lerp(_camTarget, 0.055);
      _look.x += (lx - _look.x) * 0.06;
      _look.y += (ly - _look.y) * 0.06;
      _look.z += (lz - _look.z) * 0.06;
    } else {
      state.camera.position.copy(_camTarget);
      _look.set(lx, ly, lz);
    }
    state.camera.lookAt(_look);
  });

  return (
    <group scale={q.compact ? 0.86 : 1}>
      <SceneLightRig />

      <group ref={stageRef} position={[q.compact ? 0 : 1.2, 0, 0]}>
        <group ref={spinRef}>
          {/* 54 refractive glass document shards (1 instanced draw call) */}
          <instancedMesh
            ref={shardsRef}
            args={[undefined, undefined, SHARD_TOTAL]}
            geometry={shardGeo}
            frustumCulled={false}
          >
            <GlassMaterial kind="crystal" />
          </instancedMesh>

          {/* 6 semantic hub octahedra (1 instanced draw call) */}
          <instancedMesh
            ref={anchorsRef}
            args={[undefined, undefined, ANCHOR_TOTAL]}
            frustumCulled={false}
          >
            <octahedronGeometry args={[1, 0]} />
            <GlassMaterial kind="core" emissive="#2e4bff" emissiveIntensity={0.28} />
          </instancedMesh>

          {/* 3 refractive tier datum rings */}
          {TIER_Y.map((y, tier) => (
            <mesh
              key={tier}
              ref={(m) => {
                ringRefs.current[tier] = m;
              }}
              position={[0, y, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[TIER_R[tier], 0.014, 14, 96]} />
              <GlassMaterial kind="ice" />
            </mesh>
          ))}

          {/* vector index graph — progressively drawn across Beat 2 */}
          <lineSegments geometry={LATTICE.edgeGeo} frustumCulled={false}>
            <lineBasicMaterial
              ref={lineMatRef}
              color="#6b87ff"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </lineSegments>

          {/* axial retrieval beam */}
          <mesh ref={beamRef} position={[0, 0, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 3.1, 20, 1, true]} />
            <meshBasicMaterial
              ref={beamMatRef}
              color={beamColor}
              toneMapped={false}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* retrieval light pulses racing along multi-hop vector paths */}
          <instancedMesh
            ref={pulsesRef}
            args={[undefined, undefined, PULSE_COUNT]}
            frustumCulled={false}
          >
            <sphereGeometry args={[0.048, 12, 12]} />
            <meshBasicMaterial
              color={pulseColor}
              toneMapped={false}
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </instancedMesh>

          {/* central sapphire query core + dispersive optical collar */}
          <mesh ref={coreRef} position={[0, 0, 0]}>
            <sphereGeometry args={[0.24, 36, 36]} />
            <GlassMaterial
              ref={coreMatRef}
              kind="deep"
              emissive="#2e4bff"
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh ref={lensRingRef} position={[0, 0, 0]}>
            <torusGeometry args={[0.42, 0.028, 20, 72]} />
            <GlassMaterial kind="prism" />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        parallax={q.animate ? 0.8 : 0}
        opacity={0.32}
      />
    </group>
  );
}
