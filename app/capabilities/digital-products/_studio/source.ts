/**
 * The production source of oubliai.com, as built by scripts/build-oubli-source.mjs:
 * every file verified against the live deployment, comments removed, tokenized once.
 */

export type Token = [paletteIndex: number, text: string];

interface RawFile {
  path: string;
  lang: 'tsx' | 'typescript' | 'css' | 'json';
  lines: Token[][];
}

interface RawBundle {
  v: 1;
  source: { project: string; domain: string; deployment: string };
  palette: string[];
  totalLines: number;
  files: RawFile[];
  binaries: string[];
}

export interface SourceFile extends RawFile {
  /** character offset at the end of each line, newline included */
  ends: number[];
  chars: number;
}

export interface Swatch {
  color: string;
  fontStyle?: 'italic';
}

export interface PreparedSource {
  palette: Swatch[];
  files: Map<string, SourceFile>;
  fileCount: number;
  totalLines: number;
  deployment: string;
}

const URL_JSON = '/studio-session/oubliai.json';

let pending: Promise<PreparedSource> | null = null;

function prepare(raw: RawBundle): PreparedSource {
  const palette = raw.palette.map<Swatch>((entry) => {
    const [color, flag] = entry.split(' ');
    return flag === 'i' ? { color, fontStyle: 'italic' } : { color };
  });
  const files = new Map<string, SourceFile>();
  for (const f of raw.files) {
    const ends: number[] = [];
    let at = 0;
    for (const line of f.lines) {
      for (const [, text] of line) at += text.length;
      at += 1;
      ends.push(at);
    }
    files.set(f.path, { ...f, ends, chars: at });
  }
  return {
    palette,
    files,
    fileCount: raw.files.length,
    totalLines: raw.totalLines,
    deployment: raw.source.deployment,
  };
}

/** Fetches the bundle once per page; retries after a failure. */
export function loadSource(): Promise<PreparedSource> {
  if (!pending) {
    pending = fetch(URL_JSON)
      .then((res) => {
        if (!res.ok) throw new Error(`Studio source unavailable (${res.status})`);
        return res.json() as Promise<RawBundle>;
      })
      .then(prepare)
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** First line whose end offset passes `chars`: the line the write head is on. */
export function lineAt(file: SourceFile, chars: number): number {
  let lo = 0;
  let hi = file.ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (file.ends[mid] <= chars) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The first `count` characters of a line's tokens. */
export function sliceLine(tokens: Token[], count: number): Token[] {
  const out: Token[] = [];
  let left = count;
  for (const [ci, text] of tokens) {
    if (left <= 0) break;
    if (text.length <= left) {
      out.push([ci, text]);
      left -= text.length;
    } else {
      out.push([ci, text.slice(0, left)]);
      left = 0;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- the file tree */

export interface TreeNode {
  name: string;
  path: string;
  dir: boolean;
  children: TreeNode[];
}

/** Folders first, then files, each alphabetical: the order an editor shows. */
export function buildTree(paths: readonly string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', dir: true, children: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isDir = i < parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');
      let next = node.children.find((c) => c.name === part && c.dir === isDir);
      if (!next) {
        next = { name: part, path, dir: isDir, children: [] };
        node.children.push(next);
      }
      node = next;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) =>
      a.dir === b.dir ? a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) : a.dir ? -1 : 1,
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

export function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : '';
}
