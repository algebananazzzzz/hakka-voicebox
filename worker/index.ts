import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { except } from 'hono/combine';
import { HTTPException } from 'hono/http-exception';
import { timingSafeEqual } from 'hono/utils/buffer';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ulid } from 'ulidx';
import type { Entry, Library } from '../src/shared/library';
import { AUDIO, PORTRAIT, serveMedia, storeUpload, swapMedia } from './media';
import { readLibrary, updateLibrary } from './store';
import { jsonBody, parseEntryFields, parseSettingsCopy } from './validate';

const app = new Hono<{ Bindings: Cloudflare.Env }>();

// Reads are public; every write needs the studio password.
app.use(
  '/api/*',
  except(
    (c) => c.req.method === 'GET',
    bearerAuth({
      verifyToken: (token, c) => {
        const password: string | undefined = c.env.MANAGE_PASSWORD;
        if (!password) throw new Error('MANAGE_PASSWORD is not set.');
        return timingSafeEqual(token, password);
      },
    }),
  ),
);

app.get('/api/library', async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(await readLibrary(c.env.BUCKET));
});

app.post('/api/auth/check', (c) => c.body(null, 204));

function findEntry(library: Library, id: string): Entry {
  const entry = library.entries.find((e) => e.id === id);
  if (!entry) throw new HTTPException(404, { message: 'No such entry.' });
  return entry;
}

/** Saving an entry under a name not yet in the list is how a category gets created. */
function ensureCategory(library: Library, category: string): void {
  if (!library.categories.includes(category)) library.categories.push(category);
}

app.post('/api/entries', async (c) => {
  const fields = parseEntryFields(await jsonBody(c));
  const entry = await updateLibrary(c.env.BUCKET, (library) => {
    const order = library.entries.reduce((max, e) => Math.max(max, e.order), -1) + 1;
    const created: Entry = { id: ulid(), order, audioKey: null, ...fields };
    library.entries.push(created);
    ensureCategory(library, fields.category);
    return created;
  });
  return c.json(entry, 201);
});

app.put('/api/entries/:id', async (c) => {
  const fields = parseEntryFields(await jsonBody(c));
  const entry = await updateLibrary(c.env.BUCKET, (library) => {
    const found = findEntry(library, c.req.param('id'));
    Object.assign(found, fields);
    ensureCategory(library, fields.category);
    return found;
  });
  return c.json(entry);
});

app.delete('/api/entries/:id', async (c) => {
  const audioKey = await updateLibrary(c.env.BUCKET, (library) => {
    const found = findEntry(library, c.req.param('id'));
    library.entries = library.entries.filter((e) => e !== found);
    return found.audioKey;
  });
  if (audioKey) await c.env.BUCKET.delete(audioKey);
  return c.body(null, 204);
});

app.put('/api/entries/:id/audio', async (c) => {
  const id = c.req.param('id');
  const key = await storeUpload(c, `audio/${id}/`, AUDIO);
  const entry = await swapMedia(c.env.BUCKET, key, (library) => {
    const found = findEntry(library, id);
    const previous = found.audioKey;
    found.audioKey = key;
    return { previous, result: found };
  });
  return c.json(entry);
});

app.put('/api/settings', async (c) => {
  const copy = parseSettingsCopy(await jsonBody(c));
  const settings = await updateLibrary(c.env.BUCKET, (library) => {
    Object.assign(library.settings, copy);
    return library.settings;
  });
  return c.json(settings);
});

app.put('/api/settings/greeting', async (c) => {
  const key = await storeUpload(c, 'greeting/', AUDIO);
  const settings = await swapMedia(c.env.BUCKET, key, (library) => {
    const previous = library.settings.greetingKey;
    library.settings.greetingKey = key;
    return { previous, result: library.settings };
  });
  return c.json(settings);
});

app.put('/api/settings/portrait', async (c) => {
  const key = await storeUpload(c, 'photo/', PORTRAIT);
  const settings = await swapMedia(c.env.BUCKET, key, (library) => {
    const previous = library.settings.portraitKey;
    library.settings.portraitKey = key;
    return { previous, result: library.settings };
  });
  return c.json(settings);
});

app.get('/media/:key{.+}', (c) => serveMedia(c, c.req.param('key')));

app.notFound((c) => c.json({ error: 'Not found.' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return c.json({ error: err.message || err.getResponse().statusText }, status);
  }
  console.error(err);
  return c.json({ error: 'Internal error.' }, 500);
});

export default app;
