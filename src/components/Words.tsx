import { useEffect, useRef, useState } from 'react';
import type { Entry, Kind } from '../shared/library';
import { stored } from '../lib/browser';
import { useLibrary, usePlayer } from '../lib/hooks';
import {
  ALL,
  categoryChips,
  filterEntries,
  groupByCategory,
  mediaUrl,
  ofKind,
  sealChar,
} from '../lib/library';
import { PlayState, SearchIcon, StudioLink, TopBar } from './ui';
import s from './Words.module.css';

const PREFS_KEY = 'hvb-settings';
const SCALE = { min: 0.85, max: 1.8, step: 0.15 };
const SPEED = { min: 0.55, max: 1.15, step: 0.15 };

const clamp = (v: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Math.round(v * 100) / 100));

type Lang = 'zh' | 'en' | 'hak';

function usePrefs() {
  const [textScale, setTextScale] = useState(1);
  const [speed, setSpeed] = useState(0.9);
  useEffect(() => {
    const raw = stored.get(PREFS_KEY);
    if (!raw) return;
    let prefs: { textScale?: number; speed?: number };
    try {
      prefs = JSON.parse(raw);
    } catch {
      // A corrupted preference is not worth an error; the defaults stand.
      return;
    }
    if (prefs.textScale) setTextScale(clamp(prefs.textScale, SCALE));
    if (prefs.speed) setSpeed(clamp(prefs.speed, SPEED));
  }, []);
  const save = (next: { textScale: number; speed: number }) =>
    stored.set(PREFS_KEY, JSON.stringify(next));
  return {
    textScale,
    speed,
    setTextScale: (v: number) => {
      const t = clamp(v, SCALE);
      setTextScale(t);
      save({ textScale: t, speed });
    },
    setSpeed: (v: number) => {
      const sp = clamp(v, SPEED);
      setSpeed(sp);
      save({ textScale, speed: sp });
    },
  };
}

function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    setAvailable(true);
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener('voiceschanged', load);
    return () => synth.removeEventListener('voiceschanged', load);
  }, []);
  const pick = (prefixes: string[]) => {
    for (const p of prefixes) {
      const v = voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(p));
      if (v) return v;
    }
    return null;
  };
  return { available, pick };
}

export default function Words() {
  const { library, failed } = useLibrary();
  const player = usePlayer();
  const prefs = usePrefs();
  const voices = useVoices();
  const [tab, setTab] = useState<Kind>('word');
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const name = library?.settings.name ?? '';
  const entries = library?.entries ?? [];
  const words = ofKind(entries, 'word');
  const sentences = ofKind(entries, 'sentence');
  const inTab = tab === 'word' ? words : sentences;
  const categories = library?.categories ?? [];
  const chips = categoryChips(inTab, categories);
  const groups = groupByCategory(filterEntries(inTab, category, query), categories);
  const isWord = tab === 'word';

  function speak(key: string, text: string, lang: 'zh' | 'en') {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = prefs.speed;
    u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    const voice =
      lang === 'en' ? voices.pick(['en-us', 'en-gb', 'en']) : voices.pick(['zh-cn', 'cmn', 'zh']);
    if (voice) u.voice = voice;
    player.speak(key, u);
  }

  function switchTab(next: Kind) {
    setTab(next);
    setCategory(ALL);
  }

  return (
    <div className={s.page}>
      <TopBar seal={sealChar(name)} linkHome latin>
        <nav className={s.nav}>
          <a href="/">主页</a>
          <StudioLink />
        </nav>
      </TopBar>

      <div className={s.header}>
        <div className={s.heading}>
          <h1 className={s.title}>{name}的词库</h1>
          <p className={s.lede}>
            点一行就能听发音。<b>客家话是{name}的真人录音</b>，中文与英文用设备语音朗读。
          </p>
        </div>
        <div className={s.tools}>
          <label className={s.search}>
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索：中文 / 英文 / 拼音…"
              autoComplete="off"
              aria-label="搜索"
            />
          </label>
          <button
            className={s.prefsButton}
            onClick={() => setSettingsOpen(true)}
            title="字号 · 语速"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
              <circle cx="15" cy="7" r="2" />
              <circle cx="7" cy="17" r="2" />
            </svg>
            字号 · 语速
          </button>
        </div>
      </div>

      <div className={s.tabRow}>
        <div className={s.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={isWord}
            className={s.tab}
            onClick={() => switchTab('word')}
          >
            常用词 <span>{words.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={!isWord}
            className={s.tab}
            onClick={() => switchTab('sentence')}
          >
            整句 <span>{sentences.length}</span>
          </button>
        </div>
        <div className={s.chips}>
          {chips.map((c) => (
            <button
              key={c.key}
              className={s.chip}
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.label} <span>{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {failed && <p className={s.noMatches}>没有连上，请稍后再刷新页面。</p>}

      {library && inTab.length === 0 && (
        <div className={s.empty}>
          <div className={s.emptyGlyph}>客</div>
          <p>{isWord ? '词库还是空的。' : '整句还没有内容，录好了就会出现在这里。'}</p>
        </div>
      )}

      {library && inTab.length > 0 && groups.length === 0 && (
        <p className={s.noMatches}>没有匹配「{query}」的内容。换个词试试。</p>
      )}

      {groups.map((group) => (
        <section key={group.category} className={s.group}>
          <div className={s.groupHead}>
            <span className={s.groupName}>{group.category}</span>
            <span className={s.groupCount}>
              {group.entries.length} {isWord ? '词' : '句'}
            </span>
            <span className={s.groupRule} />
          </div>
          <div className={isWord ? s.wordGrid : s.sentenceGrid}>
            {group.entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                scale={prefs.textScale}
                playing={player.playing}
                canSpeak={voices.available}
                onPlay={(lang) => {
                  const key = `${entry.id}:${lang}`;
                  if (lang === 'hak') {
                    if (entry.audioKey) player.play(key, mediaUrl(entry.audioKey));
                  } else {
                    speak(key, lang === 'en' ? entry.en : entry.zh, lang);
                  }
                }}
              />
            ))}
          </div>
        </section>
      ))}

      <footer className={s.footer}>
        <span>客家话罗马拼音只是参考写法，发音以真人录音为准。</span>
        <a href="/">← 主页</a>
      </footer>

      {settingsOpen && (
        <PrefsDialog
          prefs={prefs}
          onClose={() => setSettingsOpen(false)}
          onTest={() => speak('settings-test', 'This is the speed.', 'en')}
          canSpeak={voices.available}
        />
      )}
    </div>
  );
}

const BADGES: Record<Lang, { label: string; className: string }> = {
  zh: { label: '中', className: 'badgeZh' },
  en: { label: 'EN', className: 'badgeEn' },
  hak: { label: '客', className: 'badgeHak' },
};

function EntryCard({
  entry,
  scale,
  playing,
  canSpeak,
  onPlay,
}: {
  entry: Entry;
  scale: number;
  playing: string | null;
  canSpeak: boolean;
  onPlay: (lang: Lang) => void;
}) {
  const sentence = entry.kind === 'sentence';
  const lines: { lang: Lang; main: string; sub: string }[] = [
    { lang: 'zh', main: entry.zh, sub: entry.py },
    { lang: 'en', main: entry.en, sub: '' },
    { lang: 'hak', main: entry.rom, sub: '' },
  ];
  const mainSize = Math.round((sentence ? 19.5 : 17) * scale * 10) / 10;
  const subSize = Math.round((sentence ? 13.5 : 12.5) * scale * 10) / 10;
  const ctrl = Math.round(34 * Math.max(1, (scale + 1) / 2));

  return (
    <div className={s.card}>
      {lines.map(({ lang, main, sub }) => {
        const recorded = lang === 'hak' && !!entry.audioKey;
        const canPlay = lang === 'hak' ? recorded : canSpeak;
        const key = `${entry.id}:${lang}`;
        return (
          <div
            key={lang}
            className={`${s.line} ${lang === 'hak' ? s.lineHak : ''} ${sentence ? s.lineTop : ''}`}
          >
            <span className={`${s.badge} ${s[BADGES[lang].className]}`}>{BADGES[lang].label}</span>
            <span className={s.lineText}>
              <span
                className={lang === 'zh' ? s.mainZh : s.mainLatin}
                style={{ fontSize: mainSize }}
              >
                {main || '—'}
              </span>
              <span className={s.subRow}>
                {sub && (
                  <em className={s.sub} style={{ fontSize: subSize }}>
                    {sub}
                  </em>
                )}
                {recorded && <span className={s.status}>真人录音</span>}
              </span>
            </span>
            <span className={s.lineCtrl}>
              {canPlay ? (
                <button
                  className={s.play}
                  style={{ width: ctrl, height: ctrl }}
                  onClick={() => onPlay(lang)}
                  title="播放"
                  aria-label={`播放${BADGES[lang].label}`}
                >
                  <PlayState active={playing === key} size={15} />
                </button>
              ) : (
                <span className={s.noPlay} style={{ width: ctrl, height: ctrl }} title="暂无发音">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M22 9l-6 6M16 9l6 6" />
                  </svg>
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PrefsDialog({
  prefs,
  onClose,
  onTest,
  canSpeak,
}: {
  prefs: ReturnType<typeof usePrefs>;
  onClose: () => void;
  onTest: () => void;
  canSpeak: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    dialog.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const speedLabel = prefs.speed <= 0.7 ? '慢' : prefs.speed >= 1.0 ? '快' : '正常';

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="字号 · 语速"
        className={s.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.dialogHead}>
          <span>字号 · 语速</span>
          <button onClick={onClose} aria-label="关闭" className={s.close}>
            ✕
          </button>
        </div>
        <div className={s.dialogBody}>
          <div>
            <div className={s.prefLabel}>
              <span>字的大小</span>
              <span>{Math.round(prefs.textScale * 100)}%</span>
            </div>
            <div className={s.prefRow}>
              <button
                className={s.stepper}
                onClick={() => prefs.setTextScale(prefs.textScale - SCALE.step)}
                aria-label="调小字"
              >
                A－
              </button>
              <input
                type="range"
                min={SCALE.min}
                max={SCALE.max}
                step="0.05"
                value={prefs.textScale}
                onChange={(e) => prefs.setTextScale(parseFloat(e.target.value))}
                aria-label="字的大小"
              />
              <button
                className={`${s.stepper} ${s.stepperBig}`}
                onClick={() => prefs.setTextScale(prefs.textScale + SCALE.step)}
                aria-label="调大字"
              >
                A＋
              </button>
            </div>
            <p
              className={s.preview}
              style={{ fontSize: Math.round(17 * prefs.textScale * 10) / 10 }}
            >
              预览 · <b>你好 Hello ngì-hó</b>
            </p>
          </div>
          <div className={s.divider} />
          <div>
            <div className={s.prefLabel}>
              <span>发音速度</span>
              <span>{speedLabel}</span>
            </div>
            <div className={s.prefRow}>
              <button
                className={s.stepper}
                onClick={() => prefs.setSpeed(prefs.speed - SPEED.step)}
                aria-label="更慢"
              >
                🐢
              </button>
              <input
                type="range"
                min={SPEED.min}
                max={SPEED.max}
                step="0.05"
                value={prefs.speed}
                onChange={(e) => prefs.setSpeed(parseFloat(e.target.value))}
                aria-label="发音速度"
              />
              <button
                className={s.stepper}
                onClick={() => prefs.setSpeed(prefs.speed + SPEED.step)}
                aria-label="更快"
              >
                🐇
              </button>
            </div>
            {canSpeak && (
              <button className={s.testSpeed} onClick={onTest}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                试听速度
              </button>
            )}
            <p className={s.prefNote}>
              只影响中文、英文的设备发音；客家话播放真人录音，不受速度影响。
            </p>
          </div>
        </div>
        <div className={s.dialogFoot}>
          <button onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}
