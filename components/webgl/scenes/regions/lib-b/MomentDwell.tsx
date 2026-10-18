import React from 'react';
import MomentMeter from './MomentMeter';
import { DWELL_VH, MOMENT_ID } from './moment';
import './moment.css';

/**
 * MomentDwell — the scroll dwell that stages a region page's signature
 * moment. A tall outer section (tracked by ScrollDirector as `moment`)
 * with a sticky full-viewport stage: the WebGL set piece plays behind it
 * while the reader scrolls. The stage carries no new copy — only the
 * city/region caption already in the deck, and a hairline meter that
 * tracks the moment's timeline.
 */
export default function MomentDwell({ city, region }: { city: string; region: string }) {
  return (
    <section
      data-scene-section={MOMENT_ID}
      className="rb-moment"
      style={{ minHeight: `${DWELL_VH}vh` }}
      aria-hidden="true"
    >
      <div className="rb-moment__stage">
        <MomentMeter>
          <div className="container-x rb-moment__foot">
            <span className="micro-label micro-label--ink rb-moment__caption">
              {city}
              <span className="rb-moment__sep">/</span>
              {region}
            </span>
            <span className="rb-moment__track">
              <span className="rb-moment__fill" />
            </span>
          </div>
        </MomentMeter>
      </div>
    </section>
  );
}
