import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import type { Entry, Kind, Library } from '../shared/library';
import { ApiError, friendlyError, studioApi, type StudioApi } from '../lib/api';
import { squarePortrait, stored } from '../lib/browser';
import { useLibrary, usePlayer } from '../lib/hooks';
import {
  ALL,
  categoryChips,
  filterEntries,
  mediaUrl,
  ofKind,
  recordedCount,
  sealChar,
  unrecordedFirst,
} from '../lib/library';
import EntryDialog from './EntryDialog';
import RecordDialog, { type RecordTarget } from './RecordDialog';
import { MicIcon, PlayState, SearchIcon, TopBar } from './ui';
import s from './Manage.module.css';

const PASSWORD_KEY = 'hvb-studio-password';

export default function Manage() {
  const [password, setPassword] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setPassword(stored.get(PASSWORD_KEY));
    setChecked(true);
  }, []);

  function signOut() {
    stored.remove(PASSWORD_KEY);
    setPassword(null);
  }

  if (!checked) return null;
  if (!password) {
    return (
      <PasswordGate
        onAccepted={(pw) => {
          stored.set(PASSWORD_KEY, pw);
          setPassword(pw);
        }}
      />
    );
  }
  return <Studio password={password} onSignedOut={signOut} />;
}

function PasswordGate({ onAccepted }: { onAccepted: (password: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    try {
      await studioApi(value).check();
      onAccepted(value);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className={s.gate}>
      <form className={s.gateCard} onSubmit={submit}>
        <span className={s.gateSeal}>录</span>
        <h1 className={s.gateTitle}>录音室</h1>
        <label className={s.field}>
          <span>密码</span>
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && <p className={s.error}>{error}</p>}
        <button className={s.primary} disabled={busy || !value}>
          {busy ? '正在确认…' : '进去'}
        </button>
      </form>
    </div>
  );
}

type FormState = { editing: Entry | null; kind: Kind } | null;

function Studio({ password, onSignedOut }: { password: string; onSignedOut: () => void }) {
  const api = useMemo(() => studioApi(password), [password]);
  const { library, failed, reload } = useLibrary();
  const player = usePlayer();
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const [tab, setTab] = useState<Kind>('word');
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState<RecordTarget | null>(null);
  const [form, setForm] = useState<FormState>(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }

  /** Runs a write, refreshes the library, and returns an error message for the caller to show, or null. */
  async function save(write: (api: StudioApi) => Promise<unknown>, done: string) {
    try {
      await write(api);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSignedOut();
      return friendlyError(err);
    }
    await reload();
    showToast(done);
    return null;
  }

  if (!library) {
    return (
      <div className={s.page}>
        <p className={s.loading}>{failed ? '没有连上，请稍后再刷新页面。' : '正在打开录音室…'}</p>
      </div>
    );
  }

  const words = ofKind(library.entries, 'word');
  const sentences = ofKind(library.entries, 'sentence');
  const inTab = tab === 'word' ? words : sentences;
  const chips = categoryChips(inTab, library.categories);
  const rows = unrecordedFirst(filterEntries(inTab, category, query));
  const done = recordedCount(library.entries);
  const total = library.entries.length;
  const isWord = tab === 'word';

  return (
    <div className={s.page}>
      <TopBar seal={sealChar(library.settings.name)} linkHome latin={false}>
        <a href="/words" className={s.toWords}>
          看看词库页 →
        </a>
      </TopBar>

      <h1 className={s.title}>{library.settings.name}的录音室</h1>
      <p className={s.lede}>想录哪一句，就点它旁边的红色按钮。</p>

      {toast && <div className={s.toast}>{toast}</div>}

      <GreetingCard
        library={library}
        playing={player.playing === 'greeting'}
        onPlay={(url) => player.play('greeting', url)}
        onRecord={() => setRecording({ greeting: true, zh: '想对家人说的话', rom: '' })}
      />

      <ProfileCard
        library={library}
        onSaveCopy={(copy) => save((a) => a.saveSettings(copy), '主页的文字改好了。')}
        onPortrait={async (file) => {
          let photo: Blob;
          try {
            photo = await squarePortrait(file);
          } catch {
            return '这张照片打不开，换一张试试。';
          }
          return save((a) => a.putPortrait(photo), '照片换好了。');
        }}
        onError={showToast}
      />

      <div className={s.progressCard}>
        <span className={s.progressText}>
          已经录好 <b className={s.doneNum}>{done}</b> 句，还剩{' '}
          <b className={s.leftNum}>{total - done}</b> 句
        </span>
        <div className={s.progressTrack}>
          <div
            className={s.progressFill}
            style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className={s.filterRow}>
        <div className={s.tabs} role="tablist">
          {(['word', 'sentence'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={s.tab}
              onClick={() => {
                setTab(k);
                setCategory(ALL);
              }}
            >
              {k === 'word' ? '常用词' : '整句'}{' '}
              <span>{(k === 'word' ? words : sentences).length}</span>
            </button>
          ))}
        </div>
        <label className={s.search}>
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="找一句：输入中文或英文"
            autoComplete="off"
            aria-label="找一句"
          />
        </label>
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

      <button className={s.add} onClick={() => setForm({ editing: null, kind: tab })}>
        <span>＋</span> 添加新的词句
      </button>

      {rows.length === 0 && (
        <p className={s.empty}>
          {query
            ? `没有找到「${query}」。`
            : isWord
              ? '这里还没有词。点上面「添加新的词句」。'
              : '还没有整句。点上面「添加新的词句」，选「整句」。'}
        </p>
      )}

      <div className={s.rows}>
        {rows.map((entry) => {
          const key = `${entry.id}:hak`;
          return (
            <div key={entry.id} className={s.row}>
              <div className={s.rowText}>
                <div className={s.rowZh}>{entry.zh || '—'}</div>
                <div className={s.rowSub}>
                  <span className={s.rowEn}>{entry.en}</span>
                  {entry.en && entry.rom ? ' · ' : ''}
                  <span className={s.rowRom}>{entry.rom}</span>
                </div>
              </div>
              <div className={s.rowActions}>
                {entry.audioKey ? (
                  <>
                    <span className={s.recorded}>✓ 已录好</span>
                    <button
                      className={s.listen}
                      title="听录音"
                      aria-label="听录音"
                      onClick={() => player.play(key, mediaUrl(entry.audioKey!))}
                    >
                      <PlayState active={player.playing === key} size={18} barWidth={3.5} />
                    </button>
                    <button
                      className={s.secondary}
                      onClick={() => setRecording({ id: entry.id, zh: entry.zh, rom: entry.rom })}
                    >
                      重录
                    </button>
                  </>
                ) : (
                  <button
                    className={s.recordButton}
                    onClick={() => setRecording({ id: entry.id, zh: entry.zh, rom: entry.rom })}
                  >
                    <MicIcon size={17} />
                    录音
                  </button>
                )}
                <button
                  className={s.edit}
                  title="修改文字"
                  aria-label="修改文字"
                  onClick={() => setForm({ editing: entry, kind: entry.kind })}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <footer className={s.footer}>录音存在网上，家人在哪台设备都听得到。</footer>

      {recording && (
        <RecordDialog
          target={recording}
          player={player}
          onClose={() => setRecording(null)}
          onSave={async (blob) => {
            const error =
              'greeting' in recording
                ? await save((a) => a.putGreeting(blob), '问候录好了！主页上就能听到。')
                : await save(
                    (a) => a.putEntryAudio(recording.id, blob),
                    `录好了！「${recording.zh}」已经保存。`,
                  );
            if (!error) setRecording(null);
            return error;
          }}
        />
      )}

      {form && (
        <EntryDialog
          editing={form.editing}
          initialKind={form.kind}
          categories={library.categories}
          onClose={() => setForm(null)}
          onSave={async (fields) => {
            const editing = form.editing;
            const error = editing
              ? await save((a) => a.updateEntry(editing.id, fields), '改好了。')
              : await save((a) => a.createEntry(fields), `「${fields.zh}」加进去了，记得录音！`);
            if (!error) setForm(null);
            return error;
          }}
          onDelete={async () => {
            const editing = form.editing!;
            const error = await save((a) => a.deleteEntry(editing.id), '删掉了。');
            if (!error) setForm(null);
            return error;
          }}
        />
      )}
    </div>
  );
}

function GreetingCard({
  library,
  playing,
  onPlay,
  onRecord,
}: {
  library: Library;
  playing: boolean;
  onPlay: (url: string) => void;
  onRecord: () => void;
}) {
  const key = library.settings.greetingKey;
  return (
    <div className={`${s.card} ${s.greeting}`}>
      <div className={s.greetingText}>
        <div className={s.cardTitle}>主页的问候</div>
        <div className={s.cardNote}>
          {key
            ? '已录好。访客到主页点照片就能听到。'
            : '还没录。录一段，访客到主页就能听到这段问候。'}
        </div>
      </div>
      <div className={s.greetingActions}>
        {key && (
          <button className={s.listenWide} onClick={() => onPlay(mediaUrl(key))}>
            <PlayState active={playing} size={16} />
            听一听
          </button>
        )}
        <button className={s.recordButton} onClick={onRecord}>
          <MicIcon size={17} />
          {key ? '重录问候' : '录问候'}
        </button>
      </div>
    </div>
  );
}

function ProfileCard({
  library,
  onSaveCopy,
  onPortrait,
  onError,
}: {
  library: Library;
  onSaveCopy: (copy: { name: string; intro: string; note: string }) => Promise<string | null>;
  onPortrait: (file: File) => Promise<string | null>;
  onError: (message: string) => void;
}) {
  const { settings } = library;
  const [name, setName] = useState(settings.name);
  const [intro, setIntro] = useState(settings.intro);
  const [note, setNote] = useState(settings.note);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function takePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('请选一张照片。');
      return;
    }
    setUploading(true);
    const error = await onPortrait(file);
    setUploading(false);
    if (error) onError(error);
  }

  async function saveCopy() {
    const error = await onSaveCopy({ name: name.trim() || settings.name, intro, note });
    if (error) onError(error);
  }

  return (
    <div className={s.card}>
      <div className={s.cardTitle}>主页的照片和文字</div>
      <div className={s.profile}>
        <div className={s.portraitColumn}>
          <button
            className={`${s.portrait} ${dragging ? s.portraitDrag : ''}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void takePhoto(e.dataTransfer.files[0]);
            }}
            aria-label="换照片"
          >
            {settings.portraitKey ? (
              <img src={mediaUrl(settings.portraitKey)} alt="" />
            ) : (
              <span className={s.portraitEmpty}>
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                放照片进来
              </span>
            )}
            {uploading && <span className={s.portraitBusy}>正在上传…</span>}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void takePhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <span className={s.portraitHint}>把照片拖进圆圈，或点圆圈选文件。主页会跟着换。</span>
        </div>
        <div className={s.copyFields}>
          <label className={s.field}>
            <span>名字</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={s.field}>
            <span>主页的自我介绍</span>
            <textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
          </label>
          <label className={s.field}>
            <span>心愿（主页下方那段话）</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div>
            <button className={s.dark} onClick={saveCopy}>
              保存文字
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
