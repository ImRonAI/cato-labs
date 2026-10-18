import type { Quality } from '@/components/webgl/lib/quality';

/**
 * Mutable cross-fade weight (0..1) for one diorama.
 * Written by the CapabilitiesScene choreographer inside useFrame and read by
 * the diorama inside its own useFrame — transient, never React state, so the
 * store contract (no render subscriptions) holds. Semantically this is the
 * `visible: number` from the diorama interface, carried by reference so it
 * can be updated every frame without re-rendering.
 */
export interface DioramaWeight {
  current: number;
}

export interface DioramaProps {
  /** 0..1 cross-fade weight — animate group position/rotation/opacity by it; hide at 0 */
  visible: DioramaWeight;
  q: Quality;
}
