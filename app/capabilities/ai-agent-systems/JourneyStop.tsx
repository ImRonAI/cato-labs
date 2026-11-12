'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { catoBus, markStopVisible, resetJourney, setStory, subscribeCato } from '@/components/webgl/kit/cato/bus';
import { journeyCopy, journeyStops, type JourneyStory } from '@/lib/content/agentJourney';
import JourneyNav from './JourneyNav';

const snapshot = () => catoBus.story;
const serverSnapshot = () => 'enterprise' as const;

export function JourneyOpening() {
  const story = useSyncExternalStore(subscribeCato, snapshot, serverSnapshot);
  useEffect(() => {
    resetJourney();
    return resetJourney;
  }, []);
  return (
    <section className="aas-opening container-x" aria-labelledby="aas-opening-title">
      <h2 id="aas-opening-title" className="h2">{journeyCopy.openingTitle}</h2>
      <p className="body-lg">{journeyCopy.opening}</p>
      <label>
        {journeyCopy.storyLabel}
        <select value={story} onChange={(event) => setStory(event.target.value as JourneyStory)}>
          {Object.entries(journeyCopy.stories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <small>{journeyCopy.review}</small>
    </section>
  );
}

export default function JourneyStop({ index, children }: { index: number; children?: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const story = useSyncExternalStore(subscribeCato, snapshot, serverSnapshot);
  const stop = journeyStops[index];
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const visible = () => {
      const rect = element.getBoundingClientRect();
      element.dataset.travelling = String(catoBus.falling);
      element.dataset.active = String(index === catoBus.stopIndex && !catoBus.falling);
      element.dataset.arrivedAt = index === catoBus.stopIndex ? String(catoBus.arrivedAt) : '';
      if (rect.top <= window.innerHeight * 0.35 && rect.bottom >= window.innerHeight * 0.65) {
        element.dataset.visible = 'true';
        const heading = element.querySelector('h2')!.getBoundingClientRect();
        const blurb = element.querySelector('.aas-stop-body')!.getBoundingClientRect();
        if (heading.top >= 0 && blurb.bottom <= window.innerHeight) markStopVisible(index);
      } else if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        element.dataset.visible = 'false';
      }
    };
    const observer = new IntersectionObserver(visible, { threshold: [0, 0.35, 0.65, 1] });
    observer.observe(element);
    window.addEventListener('scroll', visible, { passive: true });
    const unsubscribe = subscribeCato(visible);
    visible();
    return () => { observer.disconnect(); unsubscribe(); window.removeEventListener('scroll', visible); };
  }, [index]);
  return (
    <section ref={section} id={stop.id} data-scene-section={stop.id} className={`aas-stop${index === 8 ? ' aas-stop--finale' : ''}`} aria-labelledby={`${stop.id}-title`}>
      <div className="aas-stop-copy container-x">
        <div className="aas-copy-fade">
          <p className="micro-label"><span className="index-no">{String(index + 1).padStart(2, '0')}</span> {stop.eyebrow}</p>
          <h2 id={`${stop.id}-title`} className="h2 aas-stop-title">{stop.titleLines[0]}<br />{stop.titleLines[1]}</h2>
          <p className="body-lg aas-stop-body">{stop.body}</p>
          <p className="aas-story-label">{stop.illustrativeLabel}</p>
          <p className="aas-story" key={story} aria-live="polite">{stop.stories[story]}</p>
          <ul className="tag-list aas-stop-tags">{stop.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
          {index === 1 && children}
          <JourneyNav index={index} />
        </div>
        {index !== 1 && children}
      </div>
    </section>
  );
}
