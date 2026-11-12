'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { ChevronDown, Crosshair, GitBranch, SquareTerminal } from 'lucide-react';
import { AgentMark } from './Conversation';
import { buildTree, extOf, lineAt, sliceLine, type PreparedSource, type SourceFile, type Token, type TreeNode } from './source';
import type { SessionState } from './session';

const LINE_H = 20;

/* ---------------------------------------------------------------- file glyphs */

const EXT_LABEL: Record<string, string> = { tsx: 'TSX', ts: 'TS', css: 'CSS', json: '{ }', ico: 'ICO' };

function FileGlyph({ path }: { path: string }) {
  const ext = extOf(path);
  return (
    <span className={`cs-glyph cs-glyph--${ext || 'file'}`} aria-hidden="true">
      {EXT_LABEL[ext] ?? '·'}
    </span>
  );
}

/* ---------------------------------------------------------------- tree */

function TreeRows({
  nodes,
  depth,
  active,
  writing,
  canOpen,
  onOpen,
}: {
  nodes: TreeNode[];
  depth: number;
  active: string | null;
  writing: string | null;
  canOpen: (path: string) => boolean;
  onOpen: (path: string) => void;
}) {
  return (
    <>
      {nodes.map((n) =>
        n.dir ? (
          <li key={n.path} className="cs-tree__dir">
            <div className="cs-node is-dir" style={{ paddingLeft: 8 + depth * 12 }}>
              <ChevronDown size={12} aria-hidden="true" />
              <span>{n.name}</span>
            </div>
            <ul>
              <TreeRows
                nodes={n.children}
                depth={depth + 1}
                active={active}
                writing={writing}
                canOpen={canOpen}
                onOpen={onOpen}
              />
            </ul>
          </li>
        ) : (
          <li key={n.path}>
            <button
              type="button"
              data-path={n.path}
              className={`cs-node${n.path === active ? ' is-active' : ''}`}
              style={{ paddingLeft: 20 + depth * 12 }}
              onClick={() => onOpen(n.path)}
              disabled={!canOpen(n.path)}
              aria-current={n.path === active ? 'true' : undefined}
            >
              <FileGlyph path={n.path} />
              <span className="cs-node__name">{n.name}</span>
              {n.path === writing && <span className="cs-node__live" aria-label="being written" />}
            </button>
          </li>
        ),
      )}
    </>
  );
}

const FileTree = memo(function FileTree({
  paths,
  active,
  writing,
  canOpen,
  onOpen,
}: {
  paths: string[];
  active: string | null;
  writing: string | null;
  canOpen: (path: string) => boolean;
  onOpen: (path: string) => void;
}) {
  const nodes = useMemo(() => buildTree(paths), [paths]);
  const box = useRef<HTMLDivElement>(null);

  /* keep the active file in view, scrolling only the tree (never the page) */
  useEffect(() => {
    const el = box.current;
    if (!el || !active) return;
    const row = el.querySelector<HTMLElement>(`[data-path="${CSS.escape(active)}"]`);
    if (!row) return;
    const top = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    if (top < el.scrollTop + 40 || top > el.scrollTop + el.clientHeight - 60) {
      el.scrollTop = Math.max(0, top - el.clientHeight * 0.45);
    }
  }, [active, paths]);

  return (
    <div className="cs-tree" ref={box} data-lenis-prevent>
      <div className="cs-tree__head">
        <span>Explorer</span>
        <span>{paths.length ? `${paths.length} files` : ''}</span>
      </div>
      {paths.length > 0 ? (
        <ul className="cs-tree__root">
          <li className="cs-tree__dir">
            <div className="cs-node is-dir is-root">
              <ChevronDown size={12} aria-hidden="true" />
              <span>oubli</span>
            </div>
            <ul>
              <TreeRows nodes={nodes} depth={1} active={active} writing={writing} canOpen={canOpen} onOpen={onOpen} />
            </ul>
          </li>
        </ul>
      ) : (
        <p className="cs-tree__empty">No project yet</p>
      )}
    </div>
  );
});

/* ---------------------------------------------------------------- code */

const Line = memo(function Line({ n, tokens, styles }: { n: number; tokens: Token[]; styles: CSSProperties[] }) {
  return (
    <div className="cs-ln">
      <span className="cs-ln__n">{n}</span>
      <span className="cs-ln__c">
        {tokens.map(([ci, text], k) => (
          <span key={k} style={styles[ci]}>
            {text}
          </span>
        ))}
      </span>
    </div>
  );
});

function CodeBody({
  file,
  styles,
  chars,
  writing,
}: {
  file: SourceFile;
  styles: CSSProperties[];
  chars: number;
  writing: boolean;
}) {
  const full = chars >= file.chars;
  const head = full ? file.lines.length : lineAt(file, chars);
  const rows = [];
  for (let i = 0; i < head; i++) rows.push(<Line key={i} n={i + 1} tokens={file.lines[i]} styles={styles} />);
  if (!full) {
    const start = head > 0 ? file.ends[head - 1] : 0;
    const partial = sliceLine(file.lines[head], chars - start);
    rows.push(
      <div className="cs-ln is-head" key="head">
        <span className="cs-ln__n">{head + 1}</span>
        <span className="cs-ln__c">
          {partial.map(([ci, text], k) => (
            <span key={k} style={styles[ci]}>
              {text}
            </span>
          ))}
          {writing && <span className="cs-code__caret" aria-hidden="true" />}
        </span>
      </div>,
    );
  }
  return <div className="cs-code__inner">{rows}</div>;
}

function Editor({
  src,
  path,
  chars,
  writing,
  following,
  tabs,
  onOpen,
  onFollow,
}: {
  src: PreparedSource | null;
  path: string | null;
  chars: number;
  writing: boolean;
  following: boolean;
  tabs: string[];
  onOpen: (path: string) => void;
  onFollow: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);
  const styles = useMemo<CSSProperties[]>(
    () => (src ? src.palette.map((s) => (s.fontStyle ? { color: s.color, fontStyle: s.fontStyle } : { color: s.color })) : []),
    [src],
  );
  const file = path && src ? src.files.get(path) ?? null : null;
  const head = file ? (chars >= file.chars ? file.lines.length : lineAt(file, chars)) : 0;

  /* a new file starts at the top */
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = 0;
    userScrolled.current = false;
  }, [path]);

  /* follow the write head, unless the reader has scrolled away */
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !writing || userScrolled.current) return;
    const target = Math.max(0, (head + 1) * LINE_H - el.clientHeight * 0.62);
    if (target > el.scrollTop) el.scrollTop = target;
  }, [head, writing]);

  const onScroll = () => {
    const el = box.current;
    if (!el || !writing) return;
    const target = Math.min(el.scrollHeight - el.clientHeight, Math.max(0, (head + 1) * LINE_H - el.clientHeight * 0.62));
    userScrolled.current = el.scrollTop < target - LINE_H * 4;
  };

  const crumbs = path ? path.split('/') : [];
  return (
    <div className="cs-editor">
      <div className="cs-tabs" role="tablist" aria-label="Open files">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === path}
            className={`cs-tab${t === path ? ' is-active' : ''}`}
            onClick={() => onOpen(t)}
          >
            <FileGlyph path={t} />
            <span>{t.split('/').pop()}</span>
            {writing && t === path && <span className="cs-tab__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="cs-crumbs">
        {crumbs.length > 0 && (
          <span className="cs-crumbs__path">
            oubli
            {crumbs.map((c, i) => (
              <span key={i}>
                <i aria-hidden="true">/</i>
                {i === crumbs.length - 1 ? <b>{c}</b> : c}
              </span>
            ))}
          </span>
        )}
        {file && <span className="cs-crumbs__meta">{file.lines.length} lines</span>}
        {!following && (
          <button type="button" className="cs-follow" onClick={onFollow}>
            <Crosshair size={12} aria-hidden="true" />
            Follow Cato
          </button>
        )}
      </div>
      <div className="cs-code" ref={box} onScroll={onScroll} data-lenis-prevent tabIndex={0} aria-label={path ? `Source of ${path}` : 'Editor'}>
        {file ? (
          <CodeBody file={file} styles={styles} chars={chars} writing={writing} />
        ) : (
          <div className="cs-splash">
            <AgentMark size={44} />
            <p>Cato Studio</p>
            <span>Files open here as they are written.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- terminal */

const Terminal = memo(function Terminal({ entries, running }: SessionState['term']) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);
  return (
    <div className="cs-term">
      <div className="cs-term__head">
        <SquareTerminal size={13} aria-hidden="true" />
        <b>Terminal</b>
        <span>zsh · ~/oubli</span>
        {running && <span className="cs-term__busy" aria-label="running" />}
      </div>
      <div className="cs-term__body" ref={box} data-lenis-prevent>
        {entries.length === 0 && <div className="cs-term__out is-dim">Ready.</div>}
        {entries.map((e, i) =>
          e.tone === 'cmd' ? (
            <div className="cs-term__cmd" key={i}>
              <span className="cs-term__path">~/oubli</span>
              <span className="cs-term__arrow">❯</span>
              <span>{e.text}</span>
            </div>
          ) : (
            <div className={`cs-term__out is-${e.tone}`} key={i}>
              {e.tone === 'ok' && <span className="cs-term__tick">✓</span>}
              {e.text}
            </div>
          ),
        )}
        {running && <span className="cs-term__cursor" aria-hidden="true" />}
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------- the workspace */

export default function Workspace({
  src,
  state,
  pinned,
  onOpen,
  onFollow,
}: {
  src: PreparedSource | null;
  state: SessionState;
  pinned: string | null;
  onOpen: (path: string) => void;
  onFollow: () => void;
}) {
  const writingPath = state.editor.writing ? state.editor.path : null;
  const path = pinned ?? state.editor.path;
  const chars = path && path === writingPath ? state.editor.chars : Number.MAX_SAFE_INTEGER;
  const tabs = pinned && !state.tabs.includes(pinned) ? [...state.tabs.slice(-3), pinned] : state.tabs;
  const linesWritten = Object.values(state.written).reduce((a, b) => a + b, 0);
  const lang = path ? EXT_LABEL[extOf(path)] ?? '' : '';
  const canOpen = useMemo(() => (p: string) => Boolean(src?.files.has(p)), [src]);

  return (
    <div className="cs-ws">
      <div className="cs-ws__top">
        <FileTree paths={state.tree} active={path} writing={writingPath} canOpen={canOpen} onOpen={onOpen} />
        <Editor
          src={src}
          path={path}
          chars={chars}
          writing={path === writingPath && writingPath !== null}
          following={pinned === null}
          tabs={tabs}
          onOpen={onOpen}
          onFollow={onFollow}
        />
      </div>
      <Terminal entries={state.term.entries} running={state.term.running} />
      <div className="cs-statusbar">
        <span>
          <GitBranch size={11} aria-hidden="true" /> main
        </span>
        <span>{state.tree.length} files</span>
        <span>{linesWritten.toLocaleString('en-US')} lines written</span>
        <span className="cs-statusbar__right">
          {lang && <span>{lang === '{ }' ? 'JSON' : lang}</span>}
          <span>UTF-8</span>
          <span>Next.js 16</span>
        </span>
      </div>
    </div>
  );
}
