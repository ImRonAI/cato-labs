'use client';

import { JSXPreview, JSXPreviewContent, JSXPreviewError } from '@/components/ai-elements/jsx-preview';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * GenUi — the generative-UI vocabulary every concierge may write inside
 * <ui>…</ui>, rendered with AI Elements' JSXPreview. Keep in sync with
 * GENUI_GUIDE in lib/genui.ts. Props are strings only; react-jsx-parser
 * blocks event handlers and anything not listed here renders as nothing.
 */

type P = { children?: ReactNode };

const Card = ({ title, subtitle, children }: P & { title?: string; subtitle?: string }) => (
  <div className="my-2 space-y-2 rounded-xl border bg-card p-3.5 text-card-foreground shadow-sm">
    {(title || subtitle) && (
      <div>
        {title && <p className="font-semibold text-sm">{title}</p>}
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
    )}
    <div className="space-y-2 text-sm">{children}</div>
  </div>
);
const Row = ({ label, value }: { label?: string; value?: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-dashed pb-1.5 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);
const Stat = ({ label, value, hint }: { label?: string; value?: string; hint?: string }) => (
  <div className="rounded-lg bg-muted px-3 py-2">
    <p className="text-muted-foreground text-xs">{label}</p>
    <p className="font-semibold text-lg leading-tight">{value}</p>
    {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
  </div>
);
const Badge = ({ children }: P) => (
  <span className="mr-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">{children}</span>
);
const Steps = ({ children }: P) => <ol className="space-y-1">{children}</ol>;
const Step = ({ done, children }: P & { done?: boolean | string }) => (
  <li className="flex items-center gap-2">
    {done !== undefined && done !== 'false' ? (
      <CheckCircle2Icon className="size-4 text-primary" />
    ) : (
      <CircleIcon className="size-4 text-muted-foreground" />
    )}
    <span>{children}</span>
  </li>
);
const Note = ({ children }: P) => <p className="rounded-md bg-accent px-2.5 py-1.5 text-accent-foreground text-xs">{children}</p>;

export const GENUI_COMPONENTS = { Card, Row, Stat, Badge, Steps, Step, Note };

/** split a reply into prose and its <ui> card (possibly still streaming) */
export function splitUi(text: string): { prose: string; jsx: string; open: boolean } {
  const start = text.indexOf('<ui>');
  if (start < 0) return { prose: text, jsx: '', open: false };
  const end = text.indexOf('</ui>', start);
  const jsx = text.slice(start + 4, end < 0 ? undefined : end).trim();
  const prose = (text.slice(0, start) + (end < 0 ? '' : text.slice(end + 5))).trim();
  return { prose, jsx, open: end < 0 };
}

export function GenUi({
  jsx,
  streaming,
  LinkButton,
}: {
  jsx: string;
  streaming: boolean;
  LinkButton: (p: { href?: string; children?: ReactNode }) => React.JSX.Element;
}) {
  if (!jsx) return null;
  return (
    <JSXPreview jsx={jsx} isStreaming={streaming} components={{ ...GENUI_COMPONENTS, LinkButton }}>
      <JSXPreviewContent />
      <JSXPreviewError className="mt-2 text-xs" />
    </JSXPreview>
  );
}
