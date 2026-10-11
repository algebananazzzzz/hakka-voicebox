import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, friendlyError, studioApi } from './api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('studioApi', () => {
  it('sends the password and the recording type with an upload', async () => {
    const fetchMock = stubFetch(Response.json({ id: 'x' }));
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/webm;codecs=opus' });
    await studioApi('pw').putEntryAudio('seed-1', blob);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/entries/seed-1/audio');
    expect(init?.method).toBe('PUT');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer pw',
      'Content-Type': 'audio/webm;codecs=opus',
    });
  });

  it('turns an error response into an ApiError carrying the server message', async () => {
    stubFetch(Response.json({ error: 'No such entry.' }, { status: 404 }));
    const err = await studioApi('pw')
      .deleteEntry('missing')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: 'No such entry.' });
  });

  it('resolves to undefined on 204', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(studioApi('pw').check()).resolves.toBeUndefined();
  });
});

describe('friendlyError', () => {
  it('explains a wrong password and a network failure in plain words', () => {
    expect(friendlyError(new ApiError(401, 'Unauthorized'))).toBe('密码不对，请重新输入。');
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe('连不上网络，请检查网络再试。');
  });
});
