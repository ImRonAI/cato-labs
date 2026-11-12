'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useScrollStore, bindPointer } from './scroll-store';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance: Lenis | null = null;
let scrollLocked = false;
/* only the section trackers this director owns — page-level ScrollTriggers
   (pinned/scrubbed DOM choreography) must survive route re-scans */
let sectionTriggers: ScrollTrigger[] = [];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Smooth-scroll to a target (used by nav anchors, back-to-top, FlagshipReel, and Cato's journey stops). */
export function scrollToTarget(
  target: string | number | HTMLElement,
  options?: {
    offset?: number;
    duration?: number;
    easing?: (t: number) => number;
    immediate?: boolean;
  },
) {
  const reduced = prefersReducedMotion();
  const immediate = options?.immediate ?? reduced;
  const offset = options?.offset ?? (typeof target === 'number' ? 0 : -90);
  const duration = options?.duration ?? 1.6;
  const easing = options?.easing ?? ((t: number) => 1 - Math.pow(1 - t, 4));
  if (lenisInstance) {
    lenisInstance.scrollTo(target as never, { offset, duration, easing, immediate });
    return;
  }
  if (typeof window === 'undefined') return;
  if (typeof target === 'number') {
    window.scrollTo({
      top: Math.max(0, target + offset),
      behavior: immediate ? 'auto' : 'smooth',
    });
    return;
  }
  const el =
    typeof target === 'string'
      ? document.querySelector<HTMLElement>(target)
      : target;
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: immediate ? 'auto' : 'smooth',
    });
  }
}

/** Pause/resume smooth scrolling (mobile menu, modals). Safe before Lenis mounts. */
export function setScrollLocked(locked: boolean) {
  scrollLocked = locked;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('is-scroll-locked', locked);
    if (!lenisInstance) {
      document.documentElement.style.overflow = locked ? 'hidden' : '';
    }
  }
  if (!lenisInstance) return;
  if (locked) lenisInstance.stop();
  else lenisInstance.start();
}

/** Current smooth-scroll position (falls back to window.scrollY). */
export function getScrollY(): number {
  return lenisInstance ? lenisInstance.scroll : typeof window !== 'undefined' ? window.scrollY : 0;
}

/**
 * ScrollDirector — owns Lenis smooth scroll, GSAP ScrollTrigger wiring,
 * and per-section progress tracking.
 *
 * DOM CONTRACT: any element carrying [data-scene-section="some-id"] is
 * tracked; its 0..1 viewport progress lands in the scroll store under
 * that id, where WebGL scenes read it every frame.
 */
export default function ScrollDirector() {
  const pathname = usePathname();

  /* Lenis + GSAP core loop — mounted once, respectful of prefers-reduced-motion. */
  useEffect(() => {
    bindPointer();
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cleanupActive: (() => void) | null = null;

    const syncMotion = () => {
      cleanupActive?.();
      cleanupActive = null;

      if (mql.matches) {
        /* Reduced motion: keep native instant scrolling (no wheel inertia) while
           still driving ScrollTrigger + scroll-store progress on native scroll. */
        lenisInstance = null;
        if (scrollLocked) {
          document.documentElement.style.overflow = 'hidden';
        }
        const onNativeScroll = () => {
          useScrollStore.getState().setScroll(window.scrollY, 0);
          ScrollTrigger.update();
        };
        window.addEventListener('scroll', onNativeScroll, { passive: true });
        onNativeScroll();
        cleanupActive = () => {
          window.removeEventListener('scroll', onNativeScroll);
        };
        return;
      }

      document.documentElement.style.overflow = '';
      const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenisInstance = lenis;
      if (scrollLocked) lenis.stop();

      lenis.on('scroll', (e: { scroll: number; velocity: number }) => {
        useScrollStore.getState().setScroll(e.scroll, e.velocity);
        ScrollTrigger.update();
      });

      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      cleanupActive = () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
        if (lenisInstance === lenis) lenisInstance = null;
      };
    };

    syncMotion();
    mql.addEventListener('change', syncMotion);

    return () => {
      mql.removeEventListener('change', syncMotion);
      cleanupActive?.();
      lenisInstance = null;
    };
  }, []);

  /* Section tracking — re-scanned on every route change. */
  useEffect(() => {
    useScrollStore.getState().setRoute(pathname);

    const setup = () => {
      sectionTriggers.forEach((t) => t.kill());
      sectionTriggers = [];
      const els = document.querySelectorAll<HTMLElement>('[data-scene-section]');
      els.forEach((el) => {
        const id = el.dataset.sceneSection!;
        sectionTriggers.push(ScrollTrigger.create({
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) =>
            useScrollStore.getState().setSection(id, {
              progress: self.progress,
              active: self.isActive,
            }),
          onToggle: (self) =>
            useScrollStore.getState().setSection(id, {
              progress: self.progress,
              active: self.isActive,
            }),
        }));
      });
      ScrollTrigger.refresh();

      /* hash deep-links (e.g. /capabilities#agents) */
      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          requestAnimationFrame(() => scrollToTarget(window.location.hash));
        }
      } else if (lenisInstance) {
        lenisInstance.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo(0, 0);
      }

      /* onUpdate only fires on change, so seed every section's current state
         (sections below the fold would otherwise stay unset until scrolled to) */
      sectionTriggers.forEach((t) => {
        const id = (t.trigger as HTMLElement).dataset.sceneSection!;
        useScrollStore.getState().setSection(id, { progress: t.progress, active: t.isActive });
      });
    };

    /* wait one frame so the new page's DOM is committed */
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(setup);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pathname]);

  return null;
}
