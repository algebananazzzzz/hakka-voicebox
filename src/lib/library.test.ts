import { describe, expect, it } from 'vitest';
import type { Entry } from '../shared/library';
import {
  ALL,
  categoryChips,
  filterEntries,
  groupByCategory,
  ofKind,
  recordedCount,
  sealChar,
  unrecordedFirst,
} from './library';

function entry(id: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    order: 0,
    category: '日常',
    kind: 'word',
    zh: id,
    en: '',
    py: '',
    rom: '',
    audioKey: null,
    ...overrides,
  };
}

describe('ofKind', () => {
  it('keeps one kind, sorted by order', () => {
    const list = [
      entry('b', { order: 2 }),
      entry('s', { kind: 'sentence' }),
      entry('a', { order: 1 }),
    ];
    expect(ofKind(list, 'word').map((e) => e.id)).toEqual(['a', 'b']);
    expect(ofKind(list, 'sentence').map((e) => e.id)).toEqual(['s']);
  });
});

describe('filterEntries', () => {
  const list = [
    entry('饭', { en: 'Rice', rom: 'fàn', category: '食物饮料' }),
    entry('水', { en: 'water', category: '食物饮料' }),
    entry('一', { en: 'one', category: '数目' }),
  ];

  it('matches any field, ignoring case and surrounding space', () => {
    expect(filterEntries(list, ALL, '  RICE ').map((e) => e.id)).toEqual(['饭']);
    expect(filterEntries(list, ALL, 'fàn').map((e) => e.id)).toEqual(['饭']);
    expect(filterEntries(list, ALL, '数目').map((e) => e.id)).toEqual(['一']);
  });

  it('limits to a category', () => {
    expect(filterEntries(list, '食物饮料', '').map((e) => e.id)).toEqual(['饭', '水']);
  });
});

describe('categoryChips', () => {
  it('counts per category in library order and skips empty ones', () => {
    const list = [entry('a', { category: '数目' }), entry('b', { category: '招呼语' })];
    const chips = categoryChips(list, ['招呼语', '屋家人', '数目']);
    expect(chips).toEqual([
      { key: ALL, label: '全部', count: 2 },
      { key: '招呼语', label: '招呼语', count: 1 },
      { key: '数目', label: '数目', count: 1 },
    ]);
  });
});

describe('groupByCategory', () => {
  it('orders groups by the library, then categories it does not list', () => {
    const list = [
      entry('a', { category: '新类' }),
      entry('b', { category: '数目' }),
      entry('c', { category: '招呼语' }),
    ];
    expect(groupByCategory(list, ['招呼语', '数目']).map((g) => g.category)).toEqual([
      '招呼语',
      '数目',
      '新类',
    ]);
  });
});

describe('unrecordedFirst', () => {
  it('moves unrecorded entries up without reordering within each half', () => {
    const list = [
      entry('r1', { audioKey: 'audio/r1' }),
      entry('u1'),
      entry('r2', { audioKey: 'audio/r2' }),
      entry('u2'),
    ];
    expect(unrecordedFirst(list).map((e) => e.id)).toEqual(['u1', 'u2', 'r1', 'r2']);
    expect(recordedCount(list)).toBe(2);
  });
});

describe('sealChar', () => {
  it('takes the first character, including ones outside the BMP', () => {
    expect(sealChar(' 杨老师')).toBe('杨');
    expect(sealChar('𠊎的')).toBe('𠊎');
    expect(sealChar('')).toBe('');
  });
});
