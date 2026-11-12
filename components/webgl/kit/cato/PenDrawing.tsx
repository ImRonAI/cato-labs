'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { catoBus } from './bus';

const VERTEX = `attribute float inkTime; varying float vTime; void main(){vTime=inkTime;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const INK = `uniform float uDraw;uniform float uDry;uniform vec3 uColor;varying float vTime;void main(){if(vTime>uDraw)discard;float fresh=exp(-max(0.,uDraw-vTime)*14.);gl_FragColor=vec4(uColor*(1.+fresh*2.),uDry*(.2+fresh*.8));}`;
const FILL_VERTEX = `attribute float inkAlpha;varying float vAlpha;varying vec3 vColor;void main(){vAlpha=inkAlpha;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FILL = `uniform float uOpacity;varying float vAlpha;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,vAlpha*uOpacity);}`;
const sat = (x: number) => Math.max(0, Math.min(1, x));
const _tip = new THREE.Vector3();

function buildDrawing(text: string, brand: string, glow: string) {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  const gradientFills = new Map<Element, string>();
  for (const node of Array.from(document.querySelectorAll('[fill^="url("]'))) {
    gradientFills.set(node, node.getAttribute('fill')!);
    node.setAttribute('fill', '#038489');
  }
  const data = new SVGLoader().parse(new XMLSerializer().serializeToString(document));
  // SVGLoader does not support gradients; restore metadata for vertex-color sampling.
  for (const path of data.paths) {
    const node = path.userData?.node as Element | undefined;
    const original = node && Array.from(gradientFills).find(([source]) => source.tagName === node.tagName && source.getAttribute('d') === node.getAttribute('d') && source.getAttribute('x') === node.getAttribute('x'));
    if (original) path.userData!.style.fill = original[1];
  }
  const bounds = new THREE.Box2();
  const contours: { points: THREE.Vector2[]; times: number[]; start: number; end: number }[] = [];
  const shapes: { shapes: THREE.Shape[]; color: THREE.Color; opacity: number; gradient: Element | null; order: number }[] = [];
  let total = 0;
  for (const path of data.paths) {
    const style = path.userData?.style ?? {};
    if (style.fill === 'none' && style.stroke === 'none') continue;
    const node = path.userData?.node as Element | undefined;
    const fill = String(style.fill ?? brand);
    const gradientId = fill.match(/url\(#([^)]*)\)/)?.[1];
    const gradient = gradientId ? data.xml.querySelector(`[id="${gradientId}"]`) : null;
    const color = fill === 'currentColor' || !node?.getAttribute('fill') && !node?.getAttribute('class')
      ? new THREE.Color(brand) : gradient ? new THREE.Color('#038489') : path.color.clone();
    if (style.fill !== 'none') shapes.push({ shapes: SVGLoader.createShapes(path), color, opacity: Number(style.opacity ?? 1) * Number(style.fillOpacity ?? 1), gradient, order: shapes.length });
    for (const sub of path.subPaths) {
      const points = sub.getPoints(32);
      if (points.length < 2) continue;
      const times = [0];
      const start = total;
      for (let i = 0; i < points.length; i++) {
        bounds.expandByPoint(points[i]);
        if (!i) continue;
        const length = points[i].distanceTo(points[i - 1]);
        const a = i > 1 ? points[i - 1].clone().sub(points[i - 2]).normalize() : null;
        const b = points[i].clone().sub(points[i - 1]).normalize();
        // Arc length plus corner cost gives the pen a physical slowdown at turns.
        total += length * (1 + (a ? 1 - a.dot(b) : 0) * 2.5);
        times.push(total - start);
      }
      contours.push({ points, times, start, end: total });
      total += Math.max(0.001, (total - start) * 0.06);
    }
  }
  const size = bounds.getSize(new THREE.Vector2());
  const center = bounds.getCenter(new THREE.Vector2());
  const factor = 1 / Math.max(size.x, size.y, 0.001);
  const normalize = (g: THREE.BufferGeometry, z = 0) => {
    g.translate(-center.x, -center.y, 0);
    g.scale(factor, -factor, factor);
    g.translate(0, 0, z);
    return g;
  };
  const strokes: THREE.BufferGeometry[] = [];
  for (const contour of contours) {
    const g = SVGLoader.pointsToStroke(contour.points, SVGLoader.getStrokeStyle(0.014 / factor, glow, 'round', 'round'));
    if (!g) continue;
    const uv = g.getAttribute('uv');
    const times = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) {
      const at = sat(uv.getX(i)) * (contour.points.length - 1);
      const n = Math.floor(at);
      const next = Math.min(contour.times.length - 1, n + 1);
      times[i] = (contour.start + THREE.MathUtils.lerp(contour.times[n], contour.times[next], at - n)) / total;
    }
    g.setAttribute('inkTime', new THREE.BufferAttribute(times, 1));
    strokes.push(normalize(g, 0.015));
  }
  const fills: THREE.BufferGeometry[] = [];
  const solids: THREE.BufferGeometry[] = [];
  for (const entry of shapes) {
    if (!entry.shapes.length) continue;
    const flat = new THREE.ShapeGeometry(entry.shapes, 16).toNonIndexed();
    const solid = new THREE.ExtrudeGeometry(entry.shapes, { depth: 0.06 / factor, bevelEnabled: true, bevelSize: 0.002 / factor, bevelThickness: 0.002 / factor, bevelSegments: 1, curveSegments: 16, steps: 1 });
    for (const g of [flat, solid]) {
      const positions = g.getAttribute('position');
      const colors = new Float32Array(positions.count * 3);
      const alpha = new Float32Array(positions.count);
      const stops = entry.gradient ? Array.from(entry.gradient.querySelectorAll('stop')).map((s) => ({ offset: parseFloat(s.getAttribute('offset') || '0'), color: new THREE.Color(s.getAttribute('stop-color') || brand) })) : [];
      const color = new THREE.Color();
      for (let i = 0; i < positions.count; i++) {
        color.copy(entry.color);
        if (entry.gradient && stops.length) {
          const x1 = Number(entry.gradient.getAttribute('x1') || 0), y1 = Number(entry.gradient.getAttribute('y1') || 0);
          const dx = Number(entry.gradient.getAttribute('x2') || 1) - x1, dy = Number(entry.gradient.getAttribute('y2') || 0) - y1;
          const u = sat(((positions.getX(i) - x1) * dx + (positions.getY(i) - y1) * dy) / (dx * dx + dy * dy));
          let j = 0;
          while (j + 1 < stops.length - 1 && stops[j + 1].offset < u) j++;
          const next = stops[Math.min(stops.length - 1, j + 1)];
          color.copy(stops[j].color).lerp(next.color, sat((u - stops[j].offset) / (next.offset - stops[j].offset || 1)));
        }
        color.toArray(colors, i * 3);
        alpha[i] = entry.opacity;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.setAttribute('inkAlpha', new THREE.BufferAttribute(alpha, 1));
      normalize(g, entry.order * 0.0005);
      g.clearGroups();
    }
    fills.push(flat); solids.push(solid);
  }
  const merge = (geometries: THREE.BufferGeometry[]) => {
    const result = geometries.length ? mergeGeometries(geometries) : new THREE.BufferGeometry();
    geometries.forEach((g) => g.dispose());
    return result!;
  };
  const lineMaterial = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: INK, uniforms: { uDraw: { value: 0 }, uDry: { value: 1 }, uColor: { value: new THREE.Color(glow).multiplyScalar(2) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const fillMaterial = new THREE.ShaderMaterial({ vertexShader: FILL_VERTEX, fragmentShader: FILL, uniforms: { uOpacity: { value: 0 } }, vertexColors: true, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
  const solidMaterial = fillMaterial.clone();
  const tipMaterial = new THREE.SpriteMaterial({ color: new THREE.Color(glow).multiplyScalar(5), toneMapped: false, depthWrite: false });
  return { line: merge(strokes), flat: merge(fills), solid: merge(solids), lineMaterial, fillMaterial, solidMaterial, tipMaterial, contours, total, center, factor };
}

export default function PenDrawing({ url, svg, color = '#000000', glow = '#7FD8E6', stop, position = [0, 0, 0], size = 1, reduced = false }: {
  url?: string; svg?: string; color?: string; glow?: string; stop: number; position?: [number, number, number]; size?: number; reduced?: boolean;
}) {
  const text = useLoader(THREE.FileLoader, url ?? `data:image/svg+xml,${encodeURIComponent(svg ?? '<svg xmlns="http://www.w3.org/2000/svg"/>')}`) as string;
  const drawing = useMemo(() => buildDrawing(text, color, glow), [text, color, glow]);
  const group = useRef<THREE.Group>(null);
  const flat = useRef<THREE.Mesh>(null);
  const solid = useRef<THREE.Mesh>(null);
  const pen = useRef<THREE.Sprite>(null);
  const elapsed = useRef(0);
  const active = useRef(false);
  const lease = useRef(0);
  const currentDrawing = useRef(drawing);
  useEffect(() => {
    currentDrawing.current = drawing;
    const version = ++lease.current;
    return () => queueMicrotask(() => {
      // Strict-mode effect replay reuses these GPU resources before the next frame.
      if (lease.current !== version && currentDrawing.current === drawing) return;
      drawing.line.dispose(); drawing.flat.dispose(); drawing.solid.dispose();
      drawing.lineMaterial.dispose(); drawing.fillMaterial.dispose(); drawing.solidMaterial.dispose(); drawing.tipMaterial.dispose();
    });
  }, [drawing]);
  useFrame((_, dt) => {
    const visible = catoBus.stopIndex === stop && !catoBus.falling;
    if (group.current) group.current.visible = visible;
    if (!visible) { elapsed.current = 0; active.current = false; return; }
    if (!active.current) { elapsed.current = 0; active.current = true; }
    elapsed.current += dt;
    const t = reduced ? 1 : elapsed.current;
    const draw = sat(t / 0.3);
    const fill = sat((t - 0.3) / 0.12);
    const lift = sat((t - 0.42) / 0.16);
    drawing.lineMaterial.uniforms.uDraw.value = draw;
    drawing.lineMaterial.uniforms.uDry.value = 1 - sat((t - 0.3) / 0.25);
    drawing.fillMaterial.uniforms.uOpacity.value = fill;
    drawing.solidMaterial.uniforms.uOpacity.value = lift;
    if (flat.current) flat.current.visible = fill > 0 && lift < 1;
    if (solid.current) { solid.current.visible = lift > 0; solid.current.scale.z = lift; }
    if (group.current) { group.current.userData.draw = draw; group.current.userData.fill = fill; group.current.userData.lift = lift; }
    if (pen.current) {
      const at = draw * drawing.total;
      let contour = 0;
      while (contour < drawing.contours.length - 1 && drawing.contours[contour].end < at) contour++;
      const path = drawing.contours[contour];
      pen.current.visible = !reduced && draw < 1 && !!path && at <= path.end;
      if (path && pen.current.visible) {
        let n = 0;
        while (n < path.times.length - 2 && path.times[n + 1] + path.start < at) n++;
        const u = sat((at - path.start - path.times[n]) / (path.times[n + 1] - path.times[n] || 1));
        _tip.set(THREE.MathUtils.lerp(path.points[n].x, path.points[n + 1].x, u) - drawing.center.x, -(THREE.MathUtils.lerp(path.points[n].y, path.points[n + 1].y, u) - drawing.center.y), 0);
        pen.current.position.copy(_tip.multiplyScalar(drawing.factor)); pen.current.position.z = 0.03;
      }
    }
  });
  return <group ref={group} name={`pen:${url ?? 'icon'}`} position={position} scale={size} visible={false} dispose={null}>
    <mesh geometry={drawing.line} material={drawing.lineMaterial} />
    <mesh ref={flat} geometry={drawing.flat} material={drawing.fillMaterial} />
    <mesh ref={solid} geometry={drawing.solid} material={drawing.solidMaterial} />
    <sprite ref={pen} scale={[0.07, 0.07, 0.07]} material={drawing.tipMaterial} />
  </group>;
}
