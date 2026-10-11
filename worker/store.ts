import { HTTPException } from 'hono/http-exception';
import { ulid } from 'ulidx';
import type { Library } from '../src/shared/library';
import { starterLibrary } from '../src/shared/starter';

export const LIBRARY_KEY = 'library.json';
const MAX_ATTEMPTS = 3;
const JSON_METADATA = { contentType: 'application/json' };

export async function readLibrary(bucket: R2Bucket): Promise<Library> {
  const object = await bucket.get(LIBRARY_KEY);
  return object ? object.json<Library>() : starterLibrary();
}

/**
 * Applies `change` to the latest library and saves it. The save only lands if
 * nobody else saved since we read, so two editors never overwrite each other;
 * on a clash we re-read and re-apply. `change` can therefore run more than once
 * and must only touch the library it is handed.
 */
export async function updateLibrary<T>(
  bucket: R2Bucket,
  change: (library: Library) => T,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await bucket.get(LIBRARY_KEY);
    const library = current ? await current.json<Library>() : starterLibrary();
    const result = change(library);
    const body = JSON.stringify(library);
    const saved = await bucket.put(LIBRARY_KEY, body, {
      onlyIf: current ? { etagMatches: current.etag } : { etagDoesNotMatch: '*' },
      httpMetadata: JSON_METADATA,
    });
    if (saved) {
      await bucket.put(`history/${ulid()}.json`, body, { httpMetadata: JSON_METADATA });
      return result;
    }
  }
  throw new HTTPException(409, { message: 'The library changed during the save. Try again.' });
}
