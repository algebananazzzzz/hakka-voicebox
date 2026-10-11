import { useEffect, useRef, useState } from 'react';
import { mediaUrl, recordedCount, sealChar } from '../lib/library';
import { useLibrary, usePlayer } from '../lib/hooks';
import { PlayState, TopBar } from './ui';
import s from './Home.module.css';

const GREETING = 'greeting';

export default function Home() {
  const { library, failed } = useLibrary();
  const player = usePlayer();
  const [hint, setHint] = useState('');
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const settings = library?.settings;
  const name = settings?.name ?? '';
  const playing = player.playing === GREETING;
  const total = library?.entries.length ?? 0;
  const recorded = library ? recordedCount(library.entries) : 0;

  function flash(message: string) {
    window.clearTimeout(hintTimer.current);
    setHint(message);
    hintTimer.current = window.setTimeout(() => setHint(''), 4200);
  }

  function playGreeting() {
    if (!settings?.greetingKey) {
      flash('这里还没有录问候。');
      return;
    }
    setHint('');
    player.play(GREETING, mediaUrl(settings.greetingKey));
  }

  return (
    <div className={s.page}>
      <TopBar seal={sealChar(name)} linkHome={false} latin>
        <nav className={s.nav}>
          <a href="/words">词库</a>
        </nav>
      </TopBar>

      <div className={s.hero}>
        <div className={s.portrait}>
          <span className={s.dashRing} />
          {playing &&
            [0, 0.6, 1.2].map((d) => (
              <i key={d} className={s.pulse} style={{ animationDelay: `${d}s` }} />
            ))}
          <div className={s.frame}>
            <div className={s.photo}>
              {settings?.portraitKey ? (
                <img src={mediaUrl(settings.portraitKey)} alt={`${name}的照片`} />
              ) : (
                library && (
                  <div className={s.noPhoto}>
                    照片还没放好
                    <br />
                    （在录音室上传）
                  </div>
                )
              )}
            </div>
          </div>

          <svg
            className={s.waves}
            width="64"
            height="88"
            viewBox="0 0 64 88"
            fill="none"
            aria-hidden
          >
            {['M8 30 Q16 44 8 58', 'M24 20 Q38 44 24 68', 'M40 10 Q60 44 40 78'].map((d, i) => (
              <path
                key={d}
                d={d}
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className={playing ? s.waveOn : s.waveOff}
                style={playing ? { animationDelay: `${i * 0.18}s` } : undefined}
              />
            ))}
          </svg>

          <button
            className={s.playButton}
            onClick={playGreeting}
            title={settings?.greetingKey ? `听${name}的问候` : '还没有录问候'}
            aria-label={playing ? '停止' : '听问候'}
          >
            <PlayState active={playing} size={playing ? 24 : 28} barWidth={5} />
          </button>

          <button className={s.bubble} onClick={playGreeting}>
            {playing ? '在听呢，慢慢听。' : '点一下，听我讲话！'}
          </button>
        </div>

        <div className={s.text}>
          <div className={s.kicker}>{name}的声音</div>
          <h1 className={s.title}>
            大家好，
            <br />
            我是<span className={s.name}>{name}</span>。
          </h1>
          <p className={s.intro}>{settings?.intro}</p>

          {failed && <p className={s.hint}>没有连上，请稍后再刷新页面。</p>}
          {hint && <p className={s.hint}>{hint}</p>}

          {total > 0 && (
            <div className={s.stat}>
              <span className={s.statBars} aria-hidden>
                <i style={{ height: 7 }} />
                <i style={{ height: 15, background: 'var(--red)' }} />
                <i style={{ height: 10 }} />
              </span>
              <span>
                {recorded > 0 ? '已经录好' : '词库已备'}
                <b>{recorded > 0 ? recorded : total}</b>
                {recorded > 0 ? '句客家话' : '句，等着一句一句录下来'}
              </span>
            </div>
          )}

          <div className={s.actions}>
            <a href="/words" className={s.cta}>
              进入词库
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {settings && (
        <div className={s.note}>
          <span className={s.tapeLeft} />
          <span className={s.tapeRight} />
          <div className={s.noteKicker}>{name}的心愿</div>
          <p className={s.noteText}>{settings.note}</p>
          <div className={s.signature}>{name}</div>
        </div>
      )}
    </div>
  );
}
