import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { EntryFields, SettingsCopy } from '../src/shared/library';

function invalid(message: string): never {
  throw new HTTPException(400, { message });
}

export async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    invalid('The body is not valid JSON.');
  }
}

function record(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    invalid('Expected a JSON object.');
  }
  return body as Record<string, unknown>;
}

function text(body: Record<string, unknown>, field: string, required: boolean): string {
  const value = body[field] ?? '';
  if (typeof value !== 'string') invalid(`"${field}" must be a string.`);
  const trimmed = value.trim();
  if (required && !trimmed) invalid(`"${field}" is required.`);
  return trimmed;
}

export function parseEntryFields(body: unknown): EntryFields {
  const b = record(body);
  const kind = b.kind;
  if (kind !== 'word' && kind !== 'sentence') invalid('"kind" must be "word" or "sentence".');
  return {
    kind,
    category: text(b, 'category', true),
    zh: text(b, 'zh', true),
    en: text(b, 'en', false),
    py: text(b, 'py', false),
    rom: text(b, 'rom', false),
  };
}

export function parseSettingsCopy(body: unknown): SettingsCopy {
  const b = record(body);
  return {
    name: text(b, 'name', true),
    intro: text(b, 'intro', false),
    note: text(b, 'note', false),
  };
}
