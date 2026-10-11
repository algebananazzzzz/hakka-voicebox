import { useCallback, useEffect, useRef, useState } from 'react';
import type { Library } from '../shared/library';
import { getLibrary } from './api';

export function useLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLibrary(await getLibrary());
      setFailed(false);
    } catch (err) {
      console.error(err);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { library, failed, reload };
}

/**
 * One shared player per page, so starting any clip or spoken line stops the
 * previous one. `playing` is the key of whatever is sounding now; calling
 * play or speak again with the same key stops it.
 */
export function usePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const playingRef = useRef<string | null>(null);
  playingRef.current = playing;

  useEffect(() => {
    const el = new Audio();
    el.onended = () => setPlaying(null);
    el.onerror = () => setPlaying(null);
    audio.current = el;
    return () => {
      el.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaying(null);
  }, []);

  const play = useCallback(
    (key: string, url: string) => {
      const toggledOff = playingRef.current === key;
      stop();
      if (toggledOff || !audio.current) return;
      audio.current.src = url;
      audio.current.play().catch(() => setPlaying(null));
      setPlaying(key);
    },
    [stop],
  );

  const speak = useCallback(
    (key: string, utterance: SpeechSynthesisUtterance) => {
      const toggledOff = playingRef.current === key;
      stop();
      if (toggledOff || !window.speechSynthesis) return;
      utterance.onend = utterance.onerror = () =>
        setPlaying((current) => (current === key ? null : current));
      setPlaying(key);
      window.speechSynthesis.speak(utterance);
    },
    [stop],
  );

  return { playing, play, speak, stop };
}

export type RecorderPhase = 'idle' | 'rec' | 'review';

function micMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '麦克风权限被拒绝。请点地址栏的麦克风图标允许后再录。';
  }
  if (name === 'NotFoundError' || name === 'NotReadableError') {
    return '找不到可用的麦克风，检查设备是否插好、没被其它程序占用。';
  }
  return '无法录音：' + (err instanceof Error ? err.message : String(err));
}

/** Microphone capture for the record modal: start, stop, then review a draft before saving. */
export function useRecorder() {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  const [micError, setMicError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const releaseMic = useCallback(() => {
    window.clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const discard = useCallback(() => {
    const r = recorder.current;
    if (r && r.state !== 'inactive') {
      r.onstop = null;
      r.stop();
    }
    releaseMic();
    recorder.current = null;
    setDraft((d) => {
      if (d) URL.revokeObjectURL(d.url);
      return null;
    });
    setPhase('idle');
    setSeconds(0);
    setMicError('');
  }, [releaseMic]);

  useEffect(() => discard, [discard]);

  const start = useCallback(async () => {
    discard();
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setMicError('这个浏览器不支持录音。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        releaseMic();
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        setDraft({ blob, url: URL.createObjectURL(blob) });
        setPhase('review');
      };
      recorder.current = r;
      r.start();
      setPhase('rec');
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setMicError(micMessage(err));
    }
  }, [discard, releaseMic]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  return { phase, seconds, draft, micError, start, stop, discard };
}
