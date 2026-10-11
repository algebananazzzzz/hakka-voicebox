export type Kind = 'word' | 'sentence';

export interface Entry {
  id: string;
  order: number;
  category: string;
  kind: Kind;
  zh: string;
  en: string;
  /** Mandarin pinyin. */
  py: string;
  /** Hakka romanisation. */
  rom: string;
  audioKey: string | null;
}

/** The editable fields of an entry; the server owns id, order and audioKey. */
export type EntryFields = Pick<Entry, 'category' | 'kind' | 'zh' | 'en' | 'py' | 'rom'>;

export interface Settings {
  name: string;
  intro: string;
  note: string;
  portraitKey: string | null;
  greetingKey: string | null;
}

export type SettingsCopy = Pick<Settings, 'name' | 'intro' | 'note'>;

export interface Library {
  version: 1;
  settings: Settings;
  categories: string[];
  entries: Entry[];
}
