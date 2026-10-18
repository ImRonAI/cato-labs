'use client';

import React from 'react';
import { practices } from '@/lib/content';
import { scrollToTarget } from '@/components/webgl/ScrollDirector';
import Reveal from '@/components/ui/Reveal';
import { cradleBus } from '@/components/webgl/scenes/capabilities/dioramas/cradle-bus';

/**
 * PracticeIndex — the hero's table of contents, etched in hairlines.
 * Small client island (page stays a server component): clicks ride the
 * Lenis smooth-scroll instead of jumping, and update the URL hash so
 * deep-links stay shareable. Hovering a practice lights its sphere in
 * the Newton's cradle behind the page (transient bus, no re-render).
 */
export default function PracticeIndex() {
  const onJump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    window.history.replaceState(null, '', `#${id}`);
    scrollToTarget(`#${id}`);
  };

  return (
    <nav aria-label="Practice index" className="cap-index">
      <ol className="cap-index__list">
        {practices.map((p, i) => (
          <li key={p.id}>
            <Reveal delay={0.55 + i * 0.07}>
              <a
                href={`#${p.id}`}
                className="cap-index__link"
                onClick={(e) => onJump(e, p.id)}
                onPointerEnter={() => {
                  cradleBus.hover = i;
                }}
                onPointerLeave={() => {
                  cradleBus.hover = -1;
                }}
                onFocus={() => {
                  cradleBus.hover = i;
                }}
                onBlur={() => {
                  cradleBus.hover = -1;
                }}
              >
                <span className="index-no">{p.index}</span>
                <span className="cap-index__title">{p.title}</span>
              </a>
            </Reveal>
          </li>
        ))}
      </ol>
    </nav>
  );
}
