'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, CodeXml, FastForward, Lock, MessagesSquare, Pause, Play, RotateCcw } from 'lucide-react';
import { oubliPlan, oubliRundown, oubliSiteUrl, studioSession } from '@/lib/content/studio';
import { AgentMark, Composer, Thread } from './Conversation';
import SiteReveal from './SiteReveal';
import Workspace from './Workspace';
import { studioMono } from './fonts';
import { initialState, playNotYet, playSession, reducer, type Action, type Phase, type RunContext } from './session';
import { loadSource, type PreparedSource } from './source';
import { Cancelled, Timeline } from './timeline';
import './studio-session.css';

/**
 * Cato Studio: a demonstration session in which a Cato agent builds oubliai.com from one
 * brief. It plays when it scrolls into view, pauses when it leaves, and ends by asking
 * whether you would like to see the site; "Yes" opens the live oubliai.com in the window.
 */

const ignoreCancel = (err: unknown) => {
  if (!(err instanceof Cancelled)) console.error(err);
};

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** The build clock, painted straight into the DOM so it never re-renders the session. */
function Clock({ tl }: { tl: Timeline | null }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!tl) return;
    const paint = () => {
      if (el.current) el.current.textContent = fmt(tl.elapsed);
    };
    paint();
    const t = window.setInterval(paint, 250);
    return () => window.clearInterval(t);
  }, [tl]);
  return (
    <span className="cs-status__clock" ref={el}>
      00:00
    </span>
  );
}

/**
 * The conversation's scroller: stays pinned to the newest message unless the reader scrolls up.
 * Only the reader's own input (wheel, touch, keys, the scrollbar) can unpin it; scroll events
 * caused by layout, such as a reasoning block collapsing above, never do.
 */
function ChatScroll({ children, resetKey, pinKey }: { children: ReactNode; resetKey: number; pinKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const touchedAt = useRef(0);
  const [away, setAway] = useState(false);

  const toBottom = useCallback(() => {
    const el = box.current;
    if (!el) return;
    stick.current = true;
    el.scrollTop = el.scrollHeight;
    setAway(false);
  }, []);

  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    const touched = () => {
      touchedAt.current = performance.now();
    };
    el.addEventListener('wheel', touched, { passive: true });
    el.addEventListener('touchmove', touched, { passive: true });
    el.addEventListener('pointerdown', touched);
    el.addEventListener('keydown', touched);
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', touched);
      el.removeEventListener('touchmove', touched);
      el.removeEventListener('pointerdown', touched);
      el.removeEventListener('keydown', touched);
    };
  }, []);

  /* a replay starts at the top of a fresh thread; a skip or an answer jumps to the newest */
  useEffect(() => {
    stick.current = true;
    setAway(false);
  }, [resetKey]);
  useEffect(() => {
    if (pinKey > 0) toBottom();
  }, [pinKey, toBottom]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    const byReader = performance.now() - touchedAt.current < 900;
    if (atBottom) stick.current = true;
    else if (byReader) stick.current = false;
    setAway(!stick.current);
  };

  return (
    <div className="cs-chat__scrollwrap">
      <div className="cs-chat__scroll" ref={box} onScroll={onScroll} data-lenis-prevent>
        <div ref={inner}>{children}</div>
      </div>
      {away && (
        <button type="button" className="cs-jump" onClick={toBottom}>
          <ArrowDown size={13} aria-hidden="true" />
          Latest
        </button>
      )}
    </div>
  );
}

export default function BuildSession() {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [src, setSrc] = useState<PreparedSource | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadTry, setLoadTry] = useState(0);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [armed, setArmed] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [pane, setPane] = useState<'chat' | 'code'>('chat');
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [framable, setFramable] = useState<boolean | null>(null);
  const [siteShown, setSiteShown] = useState(false);
  const [pinKey, setPinKey] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<RunContext | null>(null);
  const phaseRef = useRef<Phase>('idle');

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  /* fetch the source as the window approaches; start when a third of it is on screen */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const approach = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          approach.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    const seen = new IntersectionObserver(([e]) => setRatio(e.intersectionRatio), {
      threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75],
    });
    approach.observe(el);
    seen.observe(el);
    return () => {
      approach.disconnect();
      seen.disconnect();
    };
  }, []);

  useEffect(() => {
    if (ratio >= 0.35) setArmed(true);
  }, [ratio]);

  useEffect(() => {
    const sync = () => setDocHidden(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    if (!near || src) return;
    let live = true;
    setLoadError(false);
    loadSource()
      .then((s) => {
        if (live) setSrc(s);
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [near, src, loadTry]);

  /* can the finale show the live site in a frame? asked once, while the session plays */
  useEffect(() => {
    if (!src) return;
    let live = true;
    fetch('/api/oubli-frame')
      .then((res) => (res.ok ? (res.json() as Promise<{ framable?: unknown }>) : { framable: false }))
      .then((data) => {
        if (live) setFramable(data.framable === true);
      })
      .catch(() => {
        if (live) setFramable(false);
      });
    return () => {
      live = false;
    };
  }, [src]);

  /* one run per (source, replay); a replay or unmount kills the previous run's clock */
  useEffect(() => {
    if (!src || !armed) return;
    const clock = new Timeline();
    let id = 0;
    const ctx: RunContext = {
      tl: clock,
      src,
      dispatch: (a: Action) => {
        if (!clock.isKilled) rawDispatch(a);
      },
      nextId: () => ++id,
    };
    ctxRef.current = ctx;
    setTl(clock);
    rawDispatch({ type: 'reset' });
    playSession(ctx).catch(ignoreCancel);
    return () => clock.kill();
  }, [src, armed, run]);

  /* pause off screen, in a hidden tab, or on request */
  const autoPaused = ratio < 0.1 || docHidden;
  useEffect(() => {
    tl?.setPaused(userPaused || autoPaused);
  }, [tl, userPaused, autoPaused]);

  /* the clock has nothing left to do once the site is open */
  useEffect(() => {
    if (state.phase === 'site') tl?.kill();
  }, [state.phase, tl]);

  const onOpen = useCallback((path: string) => {
    setPinned(path);
    setPane('code');
  }, []);

  const onFollow = useCallback(() => setPinned(null), []);

  const onAnswer = useCallback((answer: 'yes' | 'no', el: HTMLElement) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.tl.isKilled || phaseRef.current !== 'offer') return;
    phaseRef.current = answer === 'yes' ? 'reveal' : 'running';
    setPinKey((k) => k + 1);
    ctx.dispatch({ type: 'answer', answer });
    ctx.dispatch({
      type: 'add',
      item: {
        id: ctx.nextId(),
        type: 'user',
        text: answer === 'yes' ? oubliRundown.yesReply : oubliRundown.noReply,
        brief: false,
      },
    });
    if (answer === 'yes') {
      const stage = stageRef.current;
      if (stage) {
        const s = stage.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        setOrigin({ x: b.left + b.width / 2 - s.left, y: b.top + b.height / 2 - s.top });
      }
      ctx.dispatch({ type: 'activity', text: `Opening ${studioSession.project}` });
      ctx.dispatch({ type: 'phase', phase: 'reveal' });
    } else {
      playNotYet(ctx).catch(ignoreCancel);
    }
  }, []);

  const onRevealDone = useCallback((shown: boolean) => {
    setSiteShown(shown);
    rawDispatch({ type: 'phase', phase: 'site' });
  }, []);

  const replay = useCallback(() => {
    setPinned(null);
    setOrigin(null);
    setSiteShown(false);
    setUserPaused(false);
    setPane('chat');
    setRun((r) => r + 1);
  }, []);

  const skip = useCallback(() => {
    setUserPaused(false);
    setPinKey((k) => k + 1);
    ctxRef.current?.tl.skip();
  }, []);

  const counts = useMemo(() => ({ files: src?.fileCount ?? 0, lines: src?.totalLines ?? 0 }), [src]);

  const { phase } = state;
  const paused = userPaused || autoPaused;
  const briefSent = state.items.length > 0;
  const showSite = phase === 'reveal' || phase === 'site';

  /* a polite live region carries the milestones to screen readers */
  const announce =
    phase === 'site'
      ? siteShown
        ? `${studioSession.project} is open in the window.`
        : studioSession.unframed
      : phase === 'reveal'
        ? `Opening ${studioSession.project}.`
        : phase === 'offer'
          ? `${oubliRundown.headline} ${oubliRundown.question}`
          : state.plan > 0
            ? `Step ${state.plan} of ${oubliPlan.length} done: ${oubliPlan[state.plan - 1]}.`
            : '';

  let status: { tone: 'idle' | 'busy' | 'ok' | 'warn'; label: string };
  if (loadError) status = { tone: 'warn', label: 'Offline' };
  else if (!src) status = { tone: 'idle', label: 'Loading' };
  else if (phase === 'idle') status = { tone: 'idle', label: 'Ready' };
  else if (phase === 'running') status = paused ? { tone: 'idle', label: 'Paused' } : { tone: 'busy', label: 'Building' };
  else if (phase === 'offer' || phase === 'site') status = { tone: 'ok', label: 'Deployed' };
  else status = { tone: 'busy', label: 'Opening' };

  return (
    <div className={`cs-frame ${studioMono.variable}`} ref={rootRef}>
      <div className="cs-window" data-phase={phase} aria-busy={phase === 'running'}>
        <header className="cs-titlebar">
          <div className="cs-lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="cs-title">
            <AgentMark size={20} />
            <b>{studioSession.app}</b>
            <span className="cs-title__sep" aria-hidden="true">
              /
            </span>
            <span className="cs-title__proj">{studioSession.project}</span>
            <span className="cs-chip" title={studioSession.demoNote}>
              {studioSession.demo}
            </span>
          </div>

          {phase === 'site' && siteShown ? (
            <div className="cs-address">
              <Lock size={12} aria-hidden="true" />
              <span>{studioSession.project}</span>
            </div>
          ) : (
            <div className="cs-status" data-tone={status.tone}>
              <span className="cs-status__dot" aria-hidden="true" />
              <span>{status.label}</span>
              {phase === 'running' && <Clock tl={tl} />}
            </div>
          )}

          <div className="cs-controls">
            {phase === 'running' && (
              <>
                <button
                  type="button"
                  className="cs-ctl"
                  onClick={() => setUserPaused((p) => !p)}
                  aria-label={userPaused ? 'Resume' : 'Pause'}
                >
                  {userPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
                  <span>{userPaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button type="button" className="cs-ctl" onClick={skip} aria-label="Skip to the end">
                  <FastForward size={13} aria-hidden="true" />
                  <span>Skip to the end</span>
                </button>
              </>
            )}
            {phase === 'offer' && (
              <button type="button" className="cs-ctl" onClick={replay} aria-label="Replay">
                <RotateCcw size={13} aria-hidden="true" />
                <span>Replay</span>
              </button>
            )}
            {phase === 'site' && (
              <>
                <button type="button" className="cs-ctl" onClick={replay} aria-label="Replay the build">
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Replay the build</span>
                </button>
                <a
                  className="cs-ctl cs-ctl--primary"
                  href={oubliSiteUrl}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Open ${studioSession.project} in a new tab`}
                >
                  <span>Open {studioSession.project}</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </>
            )}
          </div>
        </header>

        {!showSite && (
          <div className="cs-mtabs" role="tablist" aria-label="Panels">
            <button
              type="button"
              role="tab"
              className="cs-mtab"
              aria-selected={pane === 'chat'}
              onClick={() => setPane('chat')}
            >
              <MessagesSquare size={14} aria-hidden="true" />
              Conversation
            </button>
            <button
              type="button"
              role="tab"
              className="cs-mtab"
              aria-selected={pane === 'code'}
              onClick={() => setPane('code')}
            >
              <CodeXml size={14} aria-hidden="true" />
              Code
            </button>
          </div>
        )}

        <div className="cs-stage" ref={stageRef}>
          {phase !== 'site' && (
            <div className={`cs-body${phase === 'reveal' ? ' is-leaving' : ''}`} data-pane={pane} inert={phase === 'reveal'}>
              <section className="cs-chat" aria-label="Conversation">
                <div className="cs-activity" data-busy={(phase === 'running' && !paused) || undefined} data-ok={phase === 'offer' || undefined}>
                  <span className="cs-activity__dot" aria-hidden="true" />
                  <span className="cs-activity__text">{paused && phase === 'running' ? 'Paused' : state.activity}</span>
                </div>
                <ChatScroll resetKey={run} pinKey={pinKey}>
                  {state.items.length > 0 ? (
                    <Thread items={state.items} planDone={state.plan} counts={counts} onOpen={onOpen} onAnswer={onAnswer} />
                  ) : (
                    <div className="cs-empty">
                      <AgentMark size={40} />
                      <b>{studioSession.app}</b>
                      <span>{src ? studioSession.starting : studioSession.preparing}</span>
                    </div>
                  )}
                </ChatScroll>
                <Composer
                  text={state.composer}
                  sending={state.sending}
                  placeholder={briefSent ? studioSession.placeholderDemo : studioSession.placeholderIdle}
                />
              </section>
              <section className="cs-wspane" aria-label="Workspace">
                <Workspace src={src} state={state} pinned={pinned} onOpen={onOpen} onFollow={onFollow} />
              </section>
            </div>
          )}

          {showSite && <SiteReveal origin={origin} framable={framable} idle={ratio === 0} onDone={onRevealDone} />}

          {loadError && (
            <div className="cs-error" role="alert">
              <AgentMark size={32} />
              <p>{studioSession.error}</p>
              <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setLoadTry((n) => n + 1)}>
                {studioSession.retry}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="cs-sr" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
