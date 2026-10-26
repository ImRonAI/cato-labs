'use client';

import { create } from 'zustand';

/**
 * Global scroll + pointer state.
 * Scenes read this store TRANSIENTLY (useScrollStore.getState()) inside
 * useFrame — never subscribe in React render, or every scroll tick re-renders.
 */

export interface SectionState {
  /** 0 → 1 as the section travels through the viewport (top edge enters → bottom edge leaves). */
  progress: number;
  /** true while any part of the section is inside the viewport. */
  active: boolean;
}

interface ScrollStore {
  route: string;
  scrollY: number;
  velocity: number;
  sections: Record<string, SectionState>;
  /** Screen-space hotspots projected from the GL layer (0..1 viewport coords)
      — ProximityType reads these to tint typography under floating objects. */
  hotspots: Record<string, { x: number; y: number; intensity: number }>;
  setRoute: (route: string) => void;
  setScroll: (y: number, velocity: number) => void;
  setSection: (id: string, state: SectionState) => void;
  setHotspot: (id: string, h: { x: number; y: number; intensity: number } | null) => void;
}

export const useScrollStore = create<ScrollStore>((set) => ({
  route: '/',
  scrollY: 0,
  velocity: 0,
  sections: {},
  hotspots: {},
  /* a new route starts clean: stale progress from the previous page would
     make its set pieces render "already played" */
  setRoute: (route) => set({ route, sections: {}, hotspots: {} }),
  setScroll: (scrollY, velocity) => set({ scrollY, velocity }),
  setSection: (id, state) =>
    set((s) => ({ sections: { ...s.sections, [id]: state } })),
  setHotspot: (id, h) =>
    set((s) => {
      const hotspots = { ...s.hotspots };
      if (h === null) delete hotspots[id];
      else hotspots[id] = h;
      return { hotspots };
    }),
}));

/** Convenience for useFrame bodies: read a section's 0..1 progress (defaults 0). */
export function getSectionProgress(id: string): number {
  return useScrollStore.getState().sections[id]?.progress ?? 0;
}

/** Map a section progress value to a sub-range and clamp — the core choreography tool. */
export function sectionRange(progress: number, from: number, to: number): number {
  const span = to - from;
  if (span <= 0) return progress >= to ? 1 : 0;
  const v = (progress - from) / span;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Smoothstep easing for scroll-derived values. */
export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------ */
/*  Normalized pointer (-1..1), updated once at module level.          */
/*  Scenes import { pointer } and read inside useFrame.                */
/* ------------------------------------------------------------------ */

export const pointer = { x: 0, y: 0, active: false };

let pointerBound = false;
export function bindPointer() {
  if (pointerBound || typeof window === 'undefined') return;
  pointerBound = true;
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointer.active = true;
  });
  window.addEventListener('pointerleave', () => {
    pointer.active = false;
  });
}

/* ------------------------------------------------------------------ */
/*  Route veil bus — Nav triggers cover(), Veil component listens.     */
/* ------------------------------------------------------------------ */

type VeilHandler = () => void;
const veilHandlers = new Set<VeilHandler>();
export const veilBus = {
  cover() {
    veilHandlers.forEach((h) => h());
  },
  onCover(h: VeilHandler) {
    veilHandlers.add(h);
    return () => {
      veilHandlers.delete(h);
    };
  },
};
