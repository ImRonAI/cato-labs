import React from 'react';
import '@/app/motion.css';

/**
 * Marquee — a refined hairline ribbon: slow infinite drift, pauses on
 * hover, blue square separators between items. Pure CSS animation over
 * duplicated content (two identical groups, translateX -50% loop).
 * Reduced motion → static strip. Screen readers get the plain list once
 * via an sr-only mirror; the scrolling copy is aria-hidden.
 *
 * Server-component safe (no hooks, no client APIs).
 */
export default function Marquee({
  items,
  className = '',
  speed = 32,
  ariaLabel,
}: {
  /** ribbon items, in order */
  items: string[];
  className?: string;
  /** seconds per full loop (higher = slower) */
  speed?: number;
  /** override the accessible label (defaults to the joined items) */
  ariaLabel?: string;
}) {
  if (items.length === 0) return null;
  const label = ariaLabel ?? items.join(', ');
  return (
    <div className={`marquee ${className}`.trim()} aria-label={label}>
      <span className="motion-sr-only">{label}</span>
      <div
        className="marquee-track"
        aria-hidden="true"
        style={{ '--mq-speed': `${speed}s` } as React.CSSProperties}
      >
        {[0, 1].map((dup) => (
          <div className="marquee-group" key={dup}>
            {items.map((item, i) => (
              <React.Fragment key={i}>
                <span className="marquee-item">{item}</span>
                <span className="marquee-sep" />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
