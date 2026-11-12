import * as THREE from 'three';

/**
 * Merges multiple BufferGeometries (position + normal) into a single BufferGeometry
 * and disposes the input geometries.
 */
export function mergeBufferGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  const prepared = geoms.map((g) => {
    const geom = g.index ? g : addSequentialIndex(g);
    if (!geom.getAttribute('normal')) {
      geom.computeVertexNormals();
    }
    const pos = geom.getAttribute('position');
    const idx = geom.index!;
    totalVerts += pos.count;
    totalIndices += idx.count;
    return geom;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vertOffset = 0;
  let idxOffset = 0;

  for (const geom of prepared) {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const idx = geom.index!;

    for (let i = 0; i < pos.count; i++) {
      positions[(vertOffset + i) * 3] = pos.getX(i);
      positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        normals[(vertOffset + i) * 3] = norm.getX(i);
        normals[(vertOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    for (let i = 0; i < idx.count; i++) {
      indices[idxOffset + i] = idx.getX(i) + vertOffset;
    }

    vertOffset += pos.count;
    idxOffset += idx.count;
    geom.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

function addSequentialIndex(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const idx = new Uint32Array(pos.count);
  for (let i = 0; i < pos.count; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

export function transformedBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scale.set(1, 1, 1);
  _mat.compose(_pos, _quat, _scale);
  g.applyMatrix4(_mat);
  return g;
}

export function transformedCylinder(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scale.set(1, 1, 1);
  _mat.compose(_pos, _quat, _scale);
  g.applyMatrix4(_mat);
  return g;
}

export function buildLineGeometry(segments: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments), 3));
  return g;
}
