import type { Entry, EntryFields, Library, Settings, SettingsCopy } from '../shared/library';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body ? String(body.error) : res.statusText;
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function getLibrary(): Promise<Library> {
  return request<Library>('/api/library');
}

/** Write calls for the studio, all carrying the studio password. */
export function studioApi(password: string) {
  const auth = { Authorization: `Bearer ${password}` };
  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const file = (blob: Blob): RequestInit => ({
    method: 'PUT',
    headers: { ...auth, 'Content-Type': blob.type },
    body: blob,
  });

  return {
    check: () => request<void>('/api/auth/check', json('POST')),
    createEntry: (fields: EntryFields) => request<Entry>('/api/entries', json('POST', fields)),
    updateEntry: (id: string, fields: EntryFields) =>
      request<Entry>(`/api/entries/${encodeURIComponent(id)}`, json('PUT', fields)),
    deleteEntry: (id: string) =>
      request<void>(`/api/entries/${encodeURIComponent(id)}`, json('DELETE')),
    putEntryAudio: (id: string, audio: Blob) =>
      request<Entry>(`/api/entries/${encodeURIComponent(id)}/audio`, file(audio)),
    saveSettings: (copy: SettingsCopy) => request<Settings>('/api/settings', json('PUT', copy)),
    putGreeting: (audio: Blob) => request<Settings>('/api/settings/greeting', file(audio)),
    putPortrait: (photo: Blob) => request<Settings>('/api/settings/portrait', file(photo)),
  };
}

export type StudioApi = ReturnType<typeof studioApi>;

/** What to tell 杨老师 when a save fails: plain words, no status codes. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return '密码不对，请重新输入。';
      case 409:
        return '刚好有人也在改，请再试一次。';
      case 413:
        return '文件太大了。';
      case 415:
        return '这种文件格式不支持。';
      default:
        return '保存失败，请再试一次。';
    }
  }
  return '连不上网络，请检查网络再试。';
}
