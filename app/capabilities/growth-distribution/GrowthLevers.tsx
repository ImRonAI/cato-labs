'use client';

import React, { useCallback } from 'react';
import ChartDraw, { type ChartMilestone } from '@/components/kit/ChartDraw';
import Reveal from '@/components/ui/Reveal';

/**
 * GrowthLevers — the chart + lever islands of /capabilities/growth-distribution.
 *
 * Default export: intro copy + the animated revenue curve (ChartDraw draws
 * on scroll-enter; SSR-safe). `onExpand` scrolls to the levers section.
 * Named export LeverGrid: the four lever cards; the social lever scrolls to
 * the platform stage, the partnership card is the Fabulous Bananas spotlight.
 *
 * The figures are an illustrative composite engagement: trailing-twelve-month
 * attributable revenue, baseline → 3.2×, values in dollars (ChartDraw renders
 * them as $K).
 */

/* baseline $85K → $272K over 12 months (≈3.2×), inflections at the levers */
const REVENUE = [
  85_000, 89_500, 96_000, 104_000, 113_000, 124_000, 138_500, 155_000, 176_000,
  201_000, 233_000, 272_000,
];

const MILESTONES: ChartMilestone[] = [
  { index: 2, label: 'Technical SEO rebuilt' },
  { index: 4, label: 'AI discoverability (llms.txt + schema)' },
  { index: 6, label: 'Social engine live' },
  { index: 9, label: 'Partnership channel' },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

export default function GrowthLevers() {
  const onExpand = useCallback(() => scrollToId('growth-levers'), []);

  return (
    <Reveal delay={0.14}>
      <p className="gd-chart__intro">
        One composite engagement, twelve months, attributable revenue: a{' '}
        <b>3.2× ascent</b> with four deliberate inflections. Each milestone is a
        system switching on — never a campaign spike, always a compounding
        asset. Hover the curve; every point earned its place.
      </p>
      <div className="gd-chart">
        <ChartDraw
          data={REVENUE}
          milestones={MILESTONES}
          onExpand={onExpand}
          height={380}
        />
        <div className="gd-chart__axis-note" aria-hidden="true">
          <span>Month 01 — baseline</span>
          <span>Month 12 — 3.2×</span>
        </div>
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/*  LeverGrid — the four growth levers.                                */
/* ------------------------------------------------------------------ */

export function LeverGrid() {
  const toSocial = useCallback(() => scrollToId('growth-social'), []);

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
      </Reveal>

      <Reveal className="glass-card gd-lever" delay={0.16}>
        <span className="gd-lever__no">Lever — 03</span>
        <h3 className="h3 gd-lever__title">Social engines</h3>
        <p className="gd-lever__body">
          Not a posting calendar — an operating model. One narrative system,
          natively re-cut per platform, published on a cadence the team can
          sustain, measured against pipeline instead of applause.
        </p>
        <button type="button" className="link-line gd-lever__action" onClick={toSocial}>
          See the platforms <span aria-hidden="true">↓</span>
        </button>
      </Reveal>

      <Reveal className="glass-card gd-lever gd-lever--spotlight" delay={0.24}>
        <span className="gd-lever__tag">Partnership</span>
        <h3 className="h3 gd-lever__title">The Fabulous Bananas partnership</h3>
        <p className="gd-lever__body">
          Our growth-collaboration with Fabulous Bananas — the creative
          distribution studio. One motion, two crafts: Cato builds the system,
          Bananas makes it travel.
        </p>
        <span className="gd-lever__soon">
          <i aria-hidden="true" />
          More soon
        </span>
      </Reveal>
    </div>
  );
}
