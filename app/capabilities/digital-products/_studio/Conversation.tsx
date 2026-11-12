'use client';

import { Fragment, memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileCode2,
  ListChecks,
  LoaderCircle,
  Paperclip,
  Sparkles,
  SquareTerminal,
} from 'lucide-react';
import { oubliRundown } from '@/lib/content/studio';
import { rundownSegments, type Item, type RundownCounts, type WriteFile } from './session';

/* ---------------------------------------------------------------- marks */

/** Cato's mark: a four-point spark in a blurple orb. */
export function AgentMark({ size = 22 }: { size?: number }) {
  const gid = `cs-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className="cs-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b55ff" />
          <stop offset="0.6" stopColor="#6c5cff" />
          <stop offset="1" stopColor="#a594ff" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill={`url(#${gid})`} />
      <path
        d="M12 4.6c.5 3.6 1.8 4.9 5.4 5.4-3.6.5-4.9 1.8-5.4 5.4-.5-3.6-1.8-4.9-5.4-5.4 3.6-.5 4.9-1.8 5.4-5.4Z"
        fill="#fff"
        transform="translate(0 2)"
      />
    </svg>
  );
}

export function Caret() {
  return <span className="cs-caret" aria-hidden="true" />;
}

function Spinner() {
  return <LoaderCircle className="cs-spin" size={13} strokeWidth={2.2} aria-hidden="true" />;
}

/* ---------------------------------------------------------------- the brief */

/** Bold runs in the brief: **like this**. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** Paragraphs and "- " lists: the brief's only structure. */
export function BriefText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const head = lines[0].startsWith('- ') ? null : lines[0];
        const items = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
        return (
          <div className="cs-brief__block" key={i}>
            {head && <p>{inline(head)}</p>}
            {items.length > 0 && (
              <ul>
                {items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

function UserItem({ text, brief }: { text: string; brief: boolean }) {
  const [open, setOpen] = useState(false);
  if (!brief) {
    return (
      <div className="cs-msg cs-msg--user">
        <div className="cs-bubble cs-bubble--short">{text}</div>
      </div>
    );
  }
  const words = text.split(/\s+/).length;
  return (
    <div className="cs-msg cs-msg--user">
      <div className="cs-bubble">
        <div className="cs-bubble__label">
          <span>Brief</span>
          <span>{words} words</span>
        </div>
        <div className={`cs-brief${open ? ' is-open' : ''}`} id="cs-brief-text">
          <BriefText text={text} />
        </div>
        <button
          type="button"
          className="cs-brief__toggle"
          aria-expanded={open}
          aria-controls="cs-brief-text"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Show less' : 'Read the whole brief'}
          <ChevronRight size={13} className={open ? 'is-up' : ''} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the agent's items */

function ThinkItem({ text, done, secs }: { text: string; done: boolean; secs: number }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !done;
  return (
    <div className={`cs-think${done ? ' is-done' : ''}`}>
      <button type="button" className="cs-think__head" aria-expanded={open} onClick={() => setUserOpen(!open)}>
        <Sparkles size={14} aria-hidden="true" />
        {done ? <span>Thought for {secs}s</span> : <span className="cs-shimmer">Thinking</span>}
        <ChevronRight size={13} className={`cs-chev${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <div className={`cs-think__body${open ? ' is-open' : ''}`}>
        <div className="cs-think__inner">
          <p>
            {text}
            {!done && <Caret />}
          </p>
        </div>
      </div>
    </div>
  );
}

function SayItem({ text, done }: { text: string; done: boolean }) {
  return (
    <p className="cs-say">
      {text}
      {!done && <Caret />}
    </p>
  );
}

function PlanItem({ items, done }: { items: readonly string[]; done: number }) {
  return (
    <div className="cs-card cs-plan">
      <div className="cs-card__head">
        <span className="cs-ico">
          <ListChecks size={14} aria-hidden="true" />
        </span>
        <b>Plan</b>
        <span className="cs-plan__count">
          {Math.min(done, items.length)} / {items.length}
        </span>
      </div>
      <div className="cs-plan__bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.min(1, done / items.length)})` }} />
      </div>
      <ol>
        {items.map((t, i) => {
          const state = i < done ? 'done' : i === done ? 'now' : 'todo';
          return (
            <li key={t} data-state={state}>
              <span className="cs-plan__mark" aria-hidden="true">
                {state === 'done' ? <Check size={11} strokeWidth={3} /> : state === 'todo' ? i + 1 : null}
              </span>
              <span>{t}</span>
              <span className="cs-sr">{state === 'done' ? ' (done)' : state === 'now' ? ' (in progress)' : ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RunItem({ command, result, done, secs }: { command: string; result: string; done: boolean; secs: number }) {
  return (
    <div className={`cs-tool${done ? ' is-done' : ' is-running'}`}>
      <span className="cs-ico">
        <SquareTerminal size={14} aria-hidden="true" />
      </span>
      <div className="cs-tool__main">
        <div className="cs-tool__line">
          <span className="cs-tool__verb">{done ? 'Ran' : 'Running'}</span>
          <code className="cs-tool__cmd" title={command}>
            {command}
          </code>
        </div>
        {done && (
          <div className="cs-tool__result">
            <Check size={12} strokeWidth={2.6} aria-hidden="true" />
            {result}
          </div>
        )}
      </div>
      <span className="cs-tool__meta">{done ? `${secs}s` : <Spinner />}</span>
    </div>
  );
}

function splitPath(path: string) {
  const i = path.lastIndexOf('/');
  return i < 0 ? { dir: '', base: path } : { dir: path.slice(0, i + 1), base: path.slice(i + 1) };
}

function WriteItem({
  title,
  files,
  done,
  onOpen,
}: {
  title: string;
  files: WriteFile[];
  done: boolean;
  onOpen: (path: string) => void;
}) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !done;
  const current = files.find((f) => !f.done);
  const added = files.reduce((n, f) => n + (f.done ? f.lines : 0), 0);
  return (
    <div className={`cs-group${done ? ' is-done' : ' is-running'}`}>
      <button type="button" className="cs-group__head" aria-expanded={open} onClick={() => setUserOpen(!open)}>
        <span className="cs-ico">
          <FileCode2 size={14} aria-hidden="true" />
        </span>
        <span className="cs-group__title">
          {done ? 'Wrote' : 'Writing'} <b>{title}</b>
        </span>
        <span className="cs-group__sub">
          {done ? (
            <>
              {files.length} files <em>+{added.toLocaleString('en-US')}</em>
            </>
          ) : (
            current && splitPath(current.path).base
          )}
        </span>
        <ChevronRight size={13} className={`cs-chev${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <div className={`cs-group__body${open ? ' is-open' : ''}`}>
        <ul className="cs-group__files">
          {files.map((f) => {
            const { dir, base } = splitPath(f.path);
            return (
              <li key={f.path}>
                <button type="button" className="cs-fileRow" onClick={() => onOpen(f.path)} title={`Open ${f.path}`}>
                  <span className="cs-fileRow__path">
                    <span className="cs-fileRow__dir">{dir}</span>
                    <span className="cs-fileRow__base">{base}</span>
                  </span>
                  <span className="cs-fileRow__plus">{f.done ? `+${f.lines}` : ''}</span>
                  <span className="cs-fileRow__state">
                    {f.done ? <Check size={12} strokeWidth={2.6} aria-hidden="true" /> : <Spinner />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function FinalItem({ shown, done, counts }: { shown: number; done: boolean; counts: RundownCounts }) {
  const segs = rundownSegments(counts);
  let left = shown;
  const visible: Record<string, string> = {};
  for (const s of segs) {
    if (left <= 0) break;
    visible[s.key] = s.text.slice(0, left);
    left -= s.text.length;
  }
  const last = Object.keys(visible).at(-1);
  const caret = (key: string) => (!done && key === last ? <Caret /> : null);
  return (
    <div className="cs-final">
      {visible.headline && (
        <h4 className="cs-final__head">
          <span className="cs-live" aria-hidden="true" />
          {visible.headline}
          {caret('headline')}
        </h4>
      )}
      {visible.intro && (
        <p className="cs-final__intro">
          {visible.intro}
          {caret('intro')}
        </p>
      )}
      {visible.pt0t && (
        <ul className="cs-final__points">
          {oubliRundown.points.map((_, i) =>
            visible[`pt${i}t`] ? (
              <li key={i}>
                <b>
                  {visible[`pt${i}t`]}
                  {caret(`pt${i}t`)}
                </b>
                {visible[`pt${i}b`] && (
                  <p>
                    {visible[`pt${i}b`]}
                    {caret(`pt${i}b`)}
                  </p>
                )}
              </li>
            ) : null,
          )}
        </ul>
      )}
      {visible.stack && (
        <div className="cs-final__stack">
          {visible.stack
            .split(' · ')
            .filter(Boolean)
            .map((s) => (
              <span key={s}>{s}</span>
            ))}
        </div>
      )}
      {visible.question && (
        <p className="cs-final__q">
          {visible.question}
          {caret('question')}
        </p>
      )}
    </div>
  );
}

function OfferItem({
  mode,
  answer,
  onAnswer,
}: {
  mode: 'first' | 'later';
  answer: 'yes' | 'no' | null;
  onAnswer: (a: 'yes' | 'no', el: HTMLElement) => void;
}) {
  const locked = answer !== null;
  return (
    <div className="cs-offer" role="group" aria-label={oubliRundown.question}>
      <button
        type="button"
        className="cs-btn cs-btn--primary"
        disabled={locked}
        data-chosen={answer === 'yes' || undefined}
        onClick={(e) => onAnswer('yes', e.currentTarget)}
      >
        {mode === 'first' ? oubliRundown.yes : oubliRundown.later}
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
      {mode === 'first' && (
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          disabled={locked}
          data-chosen={answer === 'no' || undefined}
          onClick={(e) => onAnswer('no', e.currentTarget)}
        >
          {oubliRundown.no}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- the thread */

interface ItemProps {
  item: Item;
  planDone: number;
  counts: RundownCounts;
  onOpen: (path: string) => void;
  onAnswer: (a: 'yes' | 'no', el: HTMLElement) => void;
}

const ItemView = memo(function ItemView({ item, planDone, counts, onOpen, onAnswer }: ItemProps) {
  switch (item.type) {
    case 'user':
      return <UserItem text={item.text} brief={item.brief} />;
    case 'think':
      return <ThinkItem text={item.text} done={item.done} secs={item.secs} />;
    case 'say':
      return <SayItem text={item.text} done={item.done} />;
    case 'plan':
      return <PlanItem items={item.items} done={planDone} />;
    case 'run':
      return <RunItem command={item.command} result={item.result} done={item.done} secs={item.secs} />;
    case 'write':
      return <WriteItem title={item.title} files={item.files} done={item.done} onOpen={onOpen} />;
    case 'final':
      return <FinalItem shown={item.shown} done={item.done} counts={counts} />;
    case 'offer':
      return <OfferItem mode={item.mode} answer={item.answer} onAnswer={onAnswer} />;
  }
});

export function Thread({
  items,
  planDone,
  counts,
  onOpen,
  onAnswer,
}: {
  items: Item[];
  planDone: number;
  counts: RundownCounts;
  onOpen: (path: string) => void;
  onAnswer: (a: 'yes' | 'no', el: HTMLElement) => void;
}) {
  return (
    <div className="cs-thread">
      {items.map((item, i) => {
        const prev = items[i - 1];
        const turn = item.type !== 'user' && (!prev || prev.type === 'user');
        return (
          <Fragment key={item.id}>
            {turn && (
              <div className="cs-turn">
                <AgentMark size={20} />
                <b>Cato</b>
                <span>Studio agent</span>
              </div>
            )}
            <div className={`cs-item cs-item--${item.type}`}>
              <ItemView
                item={item}
                planDone={item.type === 'plan' ? planDone : 0}
                counts={counts}
                onOpen={onOpen}
                onAnswer={onAnswer}
              />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- the composer */

export function Composer({ text, sending, placeholder }: { text: string; sending: boolean; placeholder: string }) {
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = field.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);
  const cls = `cs-composer${text ? ' has-text' : ''}${sending ? ' is-sending' : ''}`;
  return (
    <div className={cls}>
      <div className="cs-composer__field" ref={field} aria-hidden={!text}>
        {text ? (
          <span className="cs-composer__text">
            {text.split('**').map((run, i) => (i % 2 ? <b key={i}>{run}</b> : <Fragment key={i}>{run}</Fragment>))}
            <Caret />
          </span>
        ) : (
          <span className="cs-composer__ph">{placeholder}</span>
        )}
      </div>
      <div className="cs-composer__bar">
        <span className="cs-pill" aria-hidden="true">
          <Paperclip size={13} />
        </span>
        <span className="cs-pill">
          <AgentMark size={14} /> Cato
        </span>
        <span className="cs-pill">Build mode</span>
        <span className="cs-send" aria-hidden="true">
          <ArrowUp size={15} strokeWidth={2.4} />
        </span>
      </div>
    </div>
  );
}
