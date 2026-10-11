import { useState } from 'react';
import { useRecorder, type usePlayer } from '../lib/hooks';
import { MicIcon, PlayState } from './ui';
import s from './Manage.module.css';

export type RecordTarget =
  { id: string; zh: string; rom: string } | { greeting: true; zh: string; rom: string };

const DRAFT = 'draft';

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function RecordDialog({
  target,
  player,
  onClose,
  onSave,
}: {
  target: RecordTarget;
  player: ReturnType<typeof usePlayer>;
  onClose: () => void;
  /** Resolves to an error message, or null once saved. */
  onSave: (audio: Blob) => Promise<string | null>;
}) {
  const recorder = useRecorder();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function close() {
    player.stop();
    recorder.discard();
    onClose();
  }

  async function save() {
    if (!recorder.draft) return;
    player.stop();
    setSaving(true);
    const error = await onSave(recorder.draft.blob);
    setSaving(false);
    if (error) setSaveError(error);
  }

  const message = recorder.micError || saveError;

  return (
    <div className={s.overlay}>
      <div
        className={`${s.dialog} ${s.recordDialog}`}
        role="dialog"
        aria-modal="true"
        aria-label="录音"
      >
        <div className={s.recordClose}>
          <button onClick={close} aria-label="关闭" className={s.close}>
            ✕
          </button>
        </div>
        <div className={s.recordBody}>
          <div className={s.recordKicker}>用客家话讲这一句</div>
          <div className={s.recordZh}>{target.zh}</div>
          {target.rom && <div className={s.recordRom}>{target.rom}</div>}

          {recorder.phase === 'idle' && (
            <>
              <button className={s.bigRecord} onClick={() => void recorder.start()}>
                <MicIcon size={22} />
                开始录音
              </button>
              <p className={s.recordHelp}>点了就开始讲，讲完再点一下。</p>
            </>
          )}

          {recorder.phase === 'rec' && (
            <>
              <div className={s.recording}>
                <span className={s.recDot} />
                <span className={s.recClock}>{clock(recorder.seconds)}</span>
                <span className={s.recLabel}>正在录…</span>
              </div>
              <button className={s.bigStop} onClick={recorder.stop}>
                <span className={s.stopSquare} />
                讲完了
              </button>
            </>
          )}

          {recorder.phase === 'review' && recorder.draft && (
            <div className={s.reviewActions}>
              <button
                className={s.listenBig}
                onClick={() => player.play(DRAFT, recorder.draft!.url)}
              >
                <PlayState active={player.playing === DRAFT} size={17} />
                先听一听
              </button>
              <button
                className={s.secondaryBig}
                onClick={() => {
                  player.stop();
                  setSaveError('');
                  void recorder.start();
                }}
              >
                再录一次
              </button>
              <button className={s.saveBig} onClick={save} disabled={saving}>
                {saving ? '正在保存…' : '✓ 就用这个'}
              </button>
            </div>
          )}

          {message && <p className={s.micMessage}>{message}</p>}
        </div>
      </div>
    </div>
  );
}
