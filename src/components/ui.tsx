import type { ReactNode } from 'react';
import s from './ui.module.css';

export function TopBar({
  seal,
  linkHome,
  latin,
  children,
}: {
  seal: string;
  linkHome: boolean;
  latin: boolean;
  children?: ReactNode;
}) {
  const brand = (
    <>
      <span className={s.seal}>{seal}</span>
      <span className={s.siteName}>客家话音库</span>
    </>
  );
  return (
    <div className={s.topBar}>
      {linkHome ? (
        <a href="/" className={s.brand}>
          {brand}
        </a>
      ) : (
        <span className={s.brand}>{brand}</span>
      )}
      {latin && <span className={s.latin}>HAKKA VOICEBOX</span>}
      <span className={s.spacer} />
      {children}
    </div>
  );
}

/** The way into the studio for 杨老师; the studio itself asks for the password. */
export function StudioLink() {
  return (
    <a href="/manage" className={s.studioLink}>
      <MicIcon size={15} />
      录音室
    </a>
  );
}

export function EqBars({ height, width = 3 }: { height: number; width?: number }) {
  return (
    <span className={s.eq} style={{ height }}>
      {[0, 0.2, 0.4].map((delay) => (
        <i key={delay} style={{ width, height, animationDelay: `${delay}s` }} />
      ))}
    </span>
  );
}

export function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function MicIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      className={s.searchIcon}
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Play/stop toggle content: bars while sounding, a triangle otherwise. */
export function PlayState({
  active,
  size,
  barWidth,
}: {
  active: boolean;
  size: number;
  barWidth?: number;
}) {
  return active ? <EqBars height={size - 2} width={barWidth} /> : <PlayIcon size={size} />;
}
