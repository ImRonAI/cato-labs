/**
 * Shared timing for the /blog "pages turning" set piece — the scene and the
 * page's DOM entry list land on the same beats.
 * Units: pinned progress (0..1) of the `pages` dwell section.
 */
export const COVER_WINDOW: readonly [number, number] = [0.02, 0.17];
export const PAGES_FROM = 0.14;
export const PAGES_TO = 0.96;
export const PAGE_DUR = 0.17;

/** start of page i's turn, for a book of n leaves */
export function pageStart(i: number, n: number): number {
  return PAGES_FROM + (i * (PAGES_TO - PAGES_FROM - PAGE_DUR)) / Math.max(n - 1, 1);
}

/** beats for the journal entries: entry e lands as a third of the leaves have turned */
export function entryMarks(entries: number, n = 9): number[] {
  return Array.from({ length: entries }, (_, e) => {
    const leaf = Math.min(n - 1, Math.round(((e + 0.5) * n) / entries - 0.5));
    return pageStart(leaf, n) + PAGE_DUR * 0.7;
  });
}
