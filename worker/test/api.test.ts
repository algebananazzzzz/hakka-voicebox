import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Entry, Library, Settings } from '../../src/shared/library';
import { starterLibrary } from '../../src/shared/starter';
import { LIBRARY_KEY, updateLibrary } from '../store';

beforeEach(async () => {
  const { objects } = await env.BUCKET.list();
  if (objects.length) await env.BUCKET.delete(objects.map((o) => o.key));
});

const AUTH = { Authorization: 'Bearer test-password' };

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`https://hakka.test${path}`, init));
}

function send(method: string, path: string, body?: unknown): Promise<Response> {
  return call(path, {
    method,
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function upload(path: string, bytes: Uint8Array, contentType: string): Promise<Response> {
  return call(path, {
    method: 'PUT',
    headers: { ...AUTH, 'Content-Type': contentType },
    body: bytes,
  });
}

async function library(): Promise<Library> {
  return (await call('/api/library')).json<Library>();
}

const WORD = {
  kind: 'word',
  category: '日常',
  zh: '食饱吂',
  en: 'Have you eaten?',
  py: '',
  rom: '',
};

describe('reading', () => {
  it('serves the starter library before anything is saved', async () => {
    const res = await call('/api/library');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const lib = await res.json<Library>();
    expect(lib.entries).toHaveLength(61);
    expect(lib.categories).toEqual(['招呼语', '屋家人', '数目', '食物饮料', '动作与形容', '日常']);
    expect(lib.settings.name).toBe('杨老师');
    expect(await env.BUCKET.head(LIBRARY_KEY)).toBeNull();
  });
});

describe('password', () => {
  it('rejects a write with no password', async () => {
    const res = await call('/api/entries', { method: 'POST', body: JSON.stringify(WORD) });
    expect(res.status).toBe(401);
  });

  it('rejects a write with the wrong password', async () => {
    const res = await call('/api/auth/check', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty('error');
  });

  it('accepts the right password', async () => {
    expect((await send('POST', '/api/auth/check')).status).toBe(204);
  });
});

describe('entries', () => {
  it('creates an entry at the end and writes a history snapshot', async () => {
    const res = await send('POST', '/api/entries', WORD);
    expect(res.status).toBe(201);
    const created = await res.json<Entry>();
    expect(created).toMatchObject({ ...WORD, order: 61, audioKey: null });

    const lib = await library();
    expect(lib.entries.at(-1)).toEqual(created);
    const history = await env.BUCKET.list({ prefix: 'history/' });
    expect(history.objects).toHaveLength(1);
  });

  it('adds a category the first time an entry uses it', async () => {
    await send('POST', '/api/entries', { ...WORD, category: '节日' });
    expect((await library()).categories.at(-1)).toBe('节日');
  });

  it('rejects an entry without Chinese text', async () => {
    const res = await send('POST', '/api/entries', { ...WORD, zh: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await call('/api/entries', { method: 'POST', headers: AUTH, body: '{oops' });
    expect(res.status).toBe(400);
  });

  it('edits an entry in place', async () => {
    const res = await send('PUT', '/api/entries/seed-0', { ...WORD, zh: '𠊎', kind: 'word' });
    expect(res.status).toBe(200);
    const edited = (await library()).entries.find((e) => e.id === 'seed-0');
    expect(edited).toMatchObject({ zh: '𠊎', order: 0, category: '日常' });
  });

  it('returns 404 for an unknown entry', async () => {
    expect((await send('PUT', '/api/entries/missing', WORD)).status).toBe(404);
  });

  it('deletes an entry and its recording', async () => {
    await upload('/api/entries/seed-1/audio', new Uint8Array([1, 2, 3]), 'audio/webm');
    const key = (await library()).entries.find((e) => e.id === 'seed-1')!.audioKey!;

    expect((await send('DELETE', '/api/entries/seed-1')).status).toBe(204);
    expect((await library()).entries.some((e) => e.id === 'seed-1')).toBe(false);
    expect(await env.BUCKET.head(key)).toBeNull();
  });
});

describe('recordings', () => {
  it('stores a recording and serves it back', async () => {
    const res = await upload(
      '/api/entries/seed-2/audio',
      new Uint8Array([9, 8, 7]),
      'audio/webm;codecs=opus',
    );
    expect(res.status).toBe(200);
    const entry = await res.json<Entry>();
    expect(entry.audioKey).toMatch(/^audio\/seed-2\/[0-9A-Z]{26}\.webm$/);

    const media = await call(`/media/${entry.audioKey}`);
    expect(media.status).toBe(200);
    expect(media.headers.get('Content-Type')).toBe('audio/webm');
    expect(media.headers.get('Cache-Control')).toContain('immutable');
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('deletes the old recording when re-recorded', async () => {
    const first = await (
      await upload('/api/entries/seed-3/audio', new Uint8Array([1]), 'audio/mp4')
    ).json<Entry>();
    expect(first.audioKey).toMatch(/\.m4a$/);
    const second = await (
      await upload('/api/entries/seed-3/audio', new Uint8Array([2]), 'audio/mp4')
    ).json<Entry>();

    expect(second.audioKey).not.toBe(first.audioKey);
    expect(await env.BUCKET.head(first.audioKey!)).toBeNull();
    expect(await env.BUCKET.head(second.audioKey!)).not.toBeNull();
  });

  it('removes the uploaded file when the entry does not exist', async () => {
    const res = await upload('/api/entries/missing/audio', new Uint8Array([1]), 'audio/webm');
    expect(res.status).toBe(404);
    expect((await env.BUCKET.list({ prefix: 'audio/' })).objects).toHaveLength(0);
  });

  it('rejects an unsupported type', async () => {
    const res = await upload('/api/entries/seed-4/audio', new Uint8Array([1]), 'video/mp4');
    expect(res.status).toBe(415);
  });

  it('rejects a recording over 8 MB', async () => {
    const big = new Uint8Array(8 * 1024 * 1024 + 1);
    const res = await upload('/api/entries/seed-4/audio', big, 'audio/webm');
    expect(res.status).toBe(413);
    expect((await env.BUCKET.list({ prefix: 'audio/' })).objects).toHaveLength(0);
  });

  it('answers a byte range request with 206, which Safari needs to play audio', async () => {
    const entry = await (
      await upload('/api/entries/seed-5/audio', new Uint8Array([0, 1, 2, 3, 4, 5]), 'audio/mp4')
    ).json<Entry>();
    const res = await call(`/media/${entry.audioKey}`, { headers: { Range: 'bytes=2-3' } });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-3/6');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([2, 3]));
  });
});

describe('settings', () => {
  it('saves the homepage text', async () => {
    const res = await send('PUT', '/api/settings', { name: ' 杨景友 ', intro: 'hi', note: 'n' });
    expect(res.status).toBe(200);
    expect((await library()).settings).toMatchObject({ name: '杨景友', intro: 'hi', note: 'n' });
  });

  it('rejects an empty name', async () => {
    expect((await send('PUT', '/api/settings', { name: '', intro: '', note: '' })).status).toBe(
      400,
    );
  });

  it('stores the greeting and the portrait', async () => {
    await upload('/api/settings/greeting', new Uint8Array([1]), 'audio/ogg');
    const settings = await (
      await upload('/api/settings/portrait', new Uint8Array([0xff, 0xd8]), 'image/jpeg')
    ).json<Settings>();
    expect(settings.greetingKey).toMatch(/^greeting\/.+\.ogg$/);
    expect(settings.portraitKey).toMatch(/^photo\/.+\.jpg$/);
  });

  it('only accepts JPEG portraits', async () => {
    const res = await upload('/api/settings/portrait', new Uint8Array([1]), 'image/png');
    expect(res.status).toBe(415);
  });
});

describe('media', () => {
  it('never serves the library file or its history', async () => {
    await send('POST', '/api/entries', WORD);
    expect((await call(`/media/${LIBRARY_KEY}`)).status).toBe(404);
    const [snapshot] = (await env.BUCKET.list({ prefix: 'history/' })).objects;
    expect((await call(`/media/${snapshot.key}`)).status).toBe(404);
  });
});

/** A bucket whose first library save is preceded by another editor's save. */
function racedBucket(otherEditor: (lib: Library) => void): R2Bucket {
  let raced = false;
  return new Proxy(env.BUCKET, {
    get(target, prop) {
      if (prop === 'put') {
        return async (key: string, ...rest: [never, never]) => {
          if (!raced && key === LIBRARY_KEY) {
            raced = true;
            const lib =
              (await (await env.BUCKET.get(LIBRARY_KEY))?.json<Library>()) ?? starterLibrary();
            otherEditor(lib);
            await target.put(LIBRARY_KEY, JSON.stringify(lib));
          }
          return target.put(key, ...rest);
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

describe('concurrent saves', () => {
  it('re-applies a change on top of a save that landed in between', async () => {
    await send('POST', '/api/entries', WORD);
    const bucket = racedBucket((lib) => (lib.settings.intro = 'from the other editor'));
    let calls = 0;
    await updateLibrary(bucket, (lib) => {
      calls++;
      lib.settings.note = 'from us';
    });
    expect(calls).toBe(2);
    expect((await library()).settings).toMatchObject({
      intro: 'from the other editor',
      note: 'from us',
    });
  });

  it('does not overwrite a library created between our read and the first-ever save', async () => {
    const bucket = racedBucket((lib) => (lib.settings.intro = 'created first'));
    let calls = 0;
    await updateLibrary(bucket, (lib) => {
      calls++;
      lib.settings.note = 'from us';
    });
    expect(calls).toBe(2);
    expect((await library()).settings).toMatchObject({ intro: 'created first', note: 'from us' });
  });

  it('gives up with 409 when every attempt is raced', async () => {
    let n = 0;
    const always = new Proxy(env.BUCKET, {
      get(target, prop) {
        if (prop === 'put') {
          return async (key: string, ...rest: [never, never]) => {
            if (key === LIBRARY_KEY)
              await target.put(LIBRARY_KEY, JSON.stringify({ ...starterLibrary(), n: n++ }));
            return target.put(key, ...rest);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(updateLibrary(always, () => {})).rejects.toMatchObject({ status: 409 });
  });
});
