import type { Entry, Kind } from '../shared/library';

export const ALL = 'all';

export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** First character of a name, for the seal. Array.from keeps characters outside the BMP (like 𠊎) whole. */
export function sealChar(name: string): string {
  return Array.from(name.trim())[0] ?? '';
}

export function ofKind(entries: Entry[], kind: Kind): Entry[] {
  return entries.filter((e) => e.kind === kind).sort((a, b) => a.order - b.order);
}

export function matches(entry: Entry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [entry.en, entry.zh, entry.py, entry.rom, entry.category]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export function filterEntries(entries: Entry[], category: string, query: string): Entry[] {
  return entries.filter((e) => (category === ALL || e.category === category) && matches(e, query));
}

export interface Chip {
  key: string;
  label: string;
  count: number;
}

/** The 全部 chip plus one chip per category that has entries, in library order. */
export function categoryChips(entries: Entry[], categories: string[]): Chip[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return [
    { key: ALL, label: '全部', count: entries.length },
    ...orderedCategories(categories, counts.keys())
      .filter((c) => counts.has(c))
      .map((c) => ({ key: c, label: c, count: counts.get(c)! })),
  ];
}

export interface Group {
  category: string;
  entries: Entry[];
}

export function groupByCategory(entries: Entry[], categories: string[]): Group[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = groups.get(e.category) ?? [];
    list.push(e);
    groups.set(e.category, list);
  }
  return orderedCategories(categories, groups.keys()).flatMap((category) => {
    const list = groups.get(category);
    return list ? [{ category, entries: list }] : [];
  });
}

/** Library order first, then any category only an entry knows about. */
function orderedCategories(categories: string[], seen: Iterable<string>): string[] {
  const extra = [...seen].filter((c) => !categories.includes(c));
  return [...categories, ...extra];
}

/** Unrecorded entries first so the studio shows what still needs recording; otherwise order is kept. */
export function unrecordedFirst(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => Number(!!a.audioKey) - Number(!!b.audioKey));
}

export function recordedCount(entries: Entry[]): number {
  return entries.filter((e) => e.audioKey).length;
}
