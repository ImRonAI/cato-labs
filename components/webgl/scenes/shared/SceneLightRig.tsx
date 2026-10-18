'use client';

import React from 'react';
import { Environment, Lightformer } from '@react-three/drei';

/**
 * SceneLightRig — THE studio lighting of catolabs.com.
 * A procedurally-generated environment (no network HDRIs) built from
 * luminous panels: cool ceiling key, a pair of thin strip lights that draw
 * long specular streaks down glass edges, electric-blue rims, an ice ring
 * that leaves a halo highlight in curved glass, soft white bounce from
 * below. Rendered once into a cube map (frames=1), so it costs nothing per
 * frame. Every scene uses this rig so glass and metal respond identically
 * on every page. Consistency is king.
 *
 * `accent` scales only the blue rims + ring (0 = neutral studio).
 */
export default function SceneLightRig({
  intensity = 1,
  accent = 1,
}: {
  intensity?: number;
  accent?: number;
}) {
  return (
    <>
      <Environment resolution={256} frames={1}>
        {/* ceiling softbox */}
        <Lightformer
          intensity={4 * intensity}
          position={[0, 5, 0]}
          rotation-x={Math.PI / 2}
          scale={[11, 11, 1]}
          color="#ffffff"
        />
        {/* twin strip lights — long specular streaks on glass edges */}
        <Lightformer
          intensity={5 * intensity}
          position={[-3.2, 2, 5]}
          rotation-y={Math.PI / 9}
          scale={[0.35, 9, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={3.4 * intensity}
          position={[3.6, 1.5, 5]}
          rotation-y={-Math.PI / 9}
          scale={[0.25, 8, 1]}
          color="#f4f7ff"
        />
        {/* blue edge, left */}
        <Lightformer
          intensity={2.6 * intensity * accent}
          position={[-7, 1.5, -3]}
          rotation-y={Math.PI / 2.6}
          scale={[7, 2.4, 1]}
          color="#b9ccff"
        />
        {/* blue edge, right */}
        <Lightformer
          intensity={2.2 * intensity * accent}
          position={[7, 0.5, -2]}
          rotation-y={-Math.PI / 2.6}
          scale={[6, 2, 1]}
          color="#e3ebff"
        />
        {/* electric kicker, low and behind — a blue rim under every silhouette */}
        <Lightformer
          intensity={1.6 * intensity * accent}
          position={[4, -2.5, -6]}
          rotation-y={-Math.PI / 5}
          scale={[8, 1.2, 1]}
          color="#6b87ff"
        />
        {/* ice ring — a halo highlight in spheres and curved glass */}
        <Lightformer
          form="ring"
          intensity={2.4 * intensity * accent}
          position={[2.5, 4, 6]}
          scale={2.2}
          color="#dce4ff"
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        />
        {/* floor bounce */}
        <Lightformer
          intensity={1.5 * intensity}
          position={[0, -4.5, 4]}
          rotation-x={-Math.PI / 3}
          scale={[9, 3, 1]}
          color="#ffffff"
        />
        {/* rear hair light */}
        <Lightformer
          intensity={1.8 * intensity}
          position={[0, 2, -8]}
          scale={[12, 4, 1]}
          color="#d5e0ff"
        />
      </Environment>
      <hemisphereLight args={['#ffffff', '#dce4ff', 0.22 * intensity]} />
      <ambientLight intensity={0.2 * intensity} />
      <directionalLight position={[5, 8, 6]} intensity={1.05 * intensity} color="#ffffff" />
      <directionalLight position={[-6, 3, -4]} intensity={0.5 * intensity * accent} color="#93a9ff" />
    </>
  );
}
