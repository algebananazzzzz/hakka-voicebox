import { useState } from 'react';
import type { Entry, EntryFields, Kind } from '../shared/library';
import s from './Manage.module.css';

export default function EntryDialog({
  editing,
  initialKind,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Entry | null;
  initialKind: Kind;
  categories: string[];
  onClose: () => void;
  /** Each resolves to an error message, or null on success. */
  onSave: (fields: EntryFields) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  const [kind, setKind] = useState<Kind>(editing?.kind ?? initialKind);
  const [zh, setZh] = useState(editing?.zh ?? '');
  const [en, setEn] = useState(editing?.en ?? '');
  const [py, setPy] = useState(editing?.py ?? '');
  const [rom, setRom] = useState(editing?.rom ?? '');
  const [category, setCategory] = useState(editing?.category ?? categories[0] ?? '日常');
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    const message = await action();
    setBusy(false);
    if (message) setError(message);
  }

  function save() {
    if (!zh.trim()) {
      setError('中文不能空着。');
      return;
    }
    const chosen = newCatOpen && newCat.trim() ? newCat.trim() : category || '日常';
    void run(() => onSave({ kind, zh, en, py, rom, category: chosen }));
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    void run(onDelete);
  }

  return (
    <div className={`${s.overlay} ${s.overlayTop}`}>
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '修改词句' : '添加新的词句'}
      >
        <div className={s.formHead}>
          <span>{editing ? '修改词句' : '添加新的词句'}</span>
          <button onClick={onClose} aria-label="关闭" className={s.close}>
            ✕
          </button>
        </div>
        <div className={s.formBody}>
          <div className={s.kindRow}>
            {(['word', 'sentence'] as const).map((k) => (
              <button
                key={k}
                className={s.kind}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k === 'word' ? '词（短）' : '整句（长）'}
              </button>
            ))}
          </div>
          <label className={s.field}>
            <span>
              中文 <b className={s.required}>*</b>
            </span>
            <input
              className={s.big}
              value={zh}
              onChange={(e) => {
                setZh(e.target.value);
                setError('');
              }}
              placeholder="例如：食饱吂？"
            />
          </label>
          <label className={s.field}>
            <span>
              英文 <em>（可以不填）</em>
            </span>
            <input
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="Have you eaten?"
            />
          </label>
          <div className={s.pair}>
            <label className={s.field}>
              <span>
                拼音 <em>（可不填）</em>
              </span>
              <input value={py} onChange={(e) => setPy(e.target.value)} placeholder="shí bǎo…" />
            </label>
            <label className={s.field}>
              <span>
                客家拼音 <em>（可不填）</em>
              </span>
              <input
                value={rom}
                onChange={(e) => setRom(e.target.value)}
                placeholder="sṳ̍t-páu màng"
              />
            </label>
          </div>
          <div className={s.catPicker}>
            <span className={s.fieldLabel}>放在哪一类</span>
            <div className={s.catChips}>
              {categories.map((c) => (
                <button
                  key={c}
                  className={s.catChip}
                  aria-pressed={!newCatOpen && category === c}
                  onClick={() => {
                    setCategory(c);
                    setNewCatOpen(false);
                  }}
                >
                  {c}
                </button>
              ))}
              <button className={s.newCat} onClick={() => setNewCatOpen(!newCatOpen)}>
                ＋ 新类
              </button>
            </div>
            {newCatOpen && (
              <input
                className={s.input}
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="新类的名字，例如：节日"
                aria-label="新类的名字"
                autoFocus
              />
            )}
          </div>
          {error && <p className={s.error}>{error}</p>}
        </div>
        <div className={s.formFoot}>
          {editing && (
            <button className={s.delete} onClick={remove} disabled={busy}>
              {confirmDelete ? '真的删？再点一下确认' : '删掉这一条'}
            </button>
          )}
          <span className={s.spacer} />
          <button className={s.secondary} onClick={onClose}>
            取消
          </button>
          <button className={s.save} onClick={save} disabled={busy}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
