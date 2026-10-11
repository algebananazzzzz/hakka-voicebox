import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ulid } from 'ulidx';
import type { Library } from '../src/shared/library';
import { updateLibrary } from './store';

interface UploadRule {
  /** Content type (without parameters) to object extension. */
  types: Record<string, string>;
  maxBytes: number;
}

// Safari's MediaRecorder produces audio/mp4; Chrome and Firefox produce webm or ogg.
export const AUDIO: UploadRule = {
  types: { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' },
  maxBytes: 8 * 1024 * 1024,
};

// The studio crops and re-encodes the portrait in the browser, so only JPEG arrives.
export const PORTRAIT: UploadRule = {
  types: { 'image/jpeg': 'jpg' },
  maxBytes: 2 * 1024 * 1024,
};

/** Key prefixes `/media/*` may serve. library.json and history/ stay private. */
const PUBLIC_PREFIXES = ['audio/', 'greeting/', 'photo/'];

/** Writes the request body to a fresh key under `prefix` and returns the key. */
export async function storeUpload(c: Context, prefix: string, rule: UploadRule): Promise<string> {
  const contentType = (c.req.header('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = rule.types[contentType];
  if (!ext) {
    throw new HTTPException(415, { message: `Unsupported content type "${contentType}".` });
  }
  if (Number(c.req.header('Content-Length')) > rule.maxBytes) {
    throw new HTTPException(413, { message: 'The file is too large.' });
  }
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength > rule.maxBytes) {
    throw new HTTPException(413, { message: 'The file is too large.' });
  }
  if (bytes.byteLength === 0) {
    throw new HTTPException(400, { message: 'The file is empty.' });
  }
  const key = `${prefix}${ulid()}.${ext}`;
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType } });
  return key;
}

/**
 * Points the library at an already-stored object, then deletes whatever it
 * replaced. The new object is written before the library references it and the
 * old one removed only after, so a failure can orphan a file but never leave
 * the library pointing at a missing one.
 */
export async function swapMedia<T>(
  bucket: R2Bucket,
  newKey: string,
  swap: (library: Library) => { previous: string | null; result: T },
): Promise<T> {
  let outcome: { previous: string | null; result: T };
  try {
    outcome = await updateLibrary(bucket, swap);
  } catch (err) {
    await bucket.delete(newKey);
    throw err;
  }
  if (outcome.previous) await bucket.delete(outcome.previous);
  return outcome.result;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Serves a media object, with Range support because Safari's <audio> refuses to play without it. */
export async function serveMedia(
  c: Context<{ Bindings: Cloudflare.Env }>,
  key: string,
): Promise<Response> {
  if (!PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    throw new HTTPException(404, { message: 'Not found.' });
  }
  const object = await c.env.BUCKET.get(key, {
    range: c.req.raw.headers,
    onlyIf: c.req.raw.headers,
  });
  if (!object) throw new HTTPException(404, { message: 'Not found.' });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', IMMUTABLE);
  headers.set('Accept-Ranges', 'bytes');

  // R2 returns an object without a body when the request's If-None-Match matched.
  if (!('body' in object)) return new Response(null, { status: 304, headers });

  if (object.range && c.req.header('Range')) {
    const { start, end } = byteSpan(object.range, object.size);
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}

function byteSpan(range: R2Range, size: number): { start: number; end: number } {
  if ('suffix' in range && range.suffix !== undefined) {
    return { start: size - range.suffix, end: size - 1 };
  }
  const start = 'offset' in range && range.offset !== undefined ? range.offset : 0;
  const length = 'length' in range && range.length !== undefined ? range.length : size - start;
  return { start, end: start + length - 1 };
}
