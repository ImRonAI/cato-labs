'use client';

import React, { useCallback } from 'react';
import Reveal from '@/components/ui/Reveal';
import { dispatchEngineDirective } from '@/components/webgl/scenes/capabilities/children/growth-distribution/engine-bus';
import type { ChannelId } from '@/lib/content/overhaul/cap-growth';
import GrowthEngine from './GrowthEngine';

/**
 * GrowthLevers — houses THE GROWTH ENGINE interactive cohort studio and
 * the four connected growth lever cards of /capabilities/growth-distribution.
 */

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'start',
  });
}

export default function GrowthLevers() {
  return (
    <Reveal delay={0.12}>
      <p className="gd-chart__intro">
        Allocate a monthly budget across six acquisition channels and choose a
        horizon. Our deterministic cohort engine projects{' '}
        <b>24 months of compounding revenue</b>, CAC payback and unit economics
        — and synchronises audience flow across the 3D glass distribution
        manifold in real time.
      </p>
      <GrowthEngine />
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/*  LeverGrid — the four growth levers, wired to THE GROWTH ENGINE.   */
/* ------------------------------------------------------------------ */

export function LeverGrid() {
  const toSocial = useCallback(() => scrollToId('growth-social'), []);

  const focusLeverInEngine = useCallback(
    (presetId: string, focusChannel: ChannelId, triggerLaunch = false) => {
      dispatchEngineDirective({ presetId, focusChannel, triggerLaunch });
      scrollToId('growth-chart');
    },
    [],
  );

  return (
    <div className="gd-levers">
      <Reveal className="glass-card gd-lever" delay={0}>
        <span className="gd-lever__no">Lever — 01</span>
        <h3 className="h3 gd-lever__title">Search &amp; SEO systems</h3>
        <p className="gd-lever__body">
          Technical foundations rebuilt first — crawl budget, information
          architecture, schema — then keyword universes mapped to intent and to
          pages. Nothing ranks by accident; every position is a position taken
          on purpose, and held.
        </p>
        <button
          type="button"
          className="link-line gd-lever__action"
          onClick={() => focusLeverInEngine('compounding-flagship', 'seo')}
        >
          Model SEO compounding <span aria-hidden="true">↑</span>
        </button>
      </Reveal>

      <Reveal className="glass-card gd-lever" delay={0.08}>
        <span className="gd-lever__no">Lever — 02</span>
        <h3 className="h3 gd-lever__title">AI discoverability</h3>
        <p className="gd-lever__body">
          Be cited by every AI. We make the brand legible to machines —
          llms.txt, structured data, an open door for AI crawlers, and
          answer-first content written to be quoted. When the agents answer,
          they answer with you.
        </p>
        <button
          type="button"
          className="link-line gd-lever__action"
          onClick={() => focusLeverInEngine('local-beachhead', 'local')}
        >
          Simulate entity &amp; local capture <span aria-hidden="true">↑</span>
        </button>
      </Reveal>

      <Reveal className="glass-card gd-lever" delay={0.16}>
        <span className="gd-lever__no">Lever — 03</span>
        <h3 className="h3 gd-lever__title">Social engines</h3>
        <p className="gd-lever__body">
          Not a posting calendar — an operating model. One narrative system,
          natively re-cut per platform, published on a cadence the team can
          sustain, measured against pipeline instead of applause.
        </p>
        <button
          type="button"
          className="link-line gd-lever__action"
          onClick={toSocial}
        >
          See the platforms <span aria-hidden="true">↓</span>
        </button>
      </Reveal>

      <Reveal className="glass-card gd-lever gd-lever--spotlight" delay={0.24}>
        <span className="gd-lever__tag">Partnership</span>
        <h3 className="h3 gd-lever__title">
          The Fabulous Bananas partnership
        </h3>
        <p className="gd-lever__body">
          Our growth-collaboration with Fabulous Bananas — the creative
          distribution studio. One motion, two crafts: Cato builds the system,
          Bananas makes it travel.
        </p>
        <button
          type="button"
          className="link-line gd-lever__action"
          onClick={() =>
            focusLeverInEngine('category-velocity', 'partners', true)
          }
        >
          Simulate partner co-drop wave <span aria-hidden="true">↑</span>
        </button>
      </Reveal>
    </div>
  );
}
