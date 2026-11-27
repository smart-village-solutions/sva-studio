import type { CatalogValue } from '@sva/core';

export class InvalidProviderResponse extends Error {}

export const readResponse = async (response: Response, limit = 262144): Promise<unknown> => {
  const reader = response.body?.getReader();
  if (!reader) throw new InvalidProviderResponse();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw new InvalidProviderResponse();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new InvalidProviderResponse();
  }
};

export const translationFailureIsTerminal = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { retry?: { kind?: unknown } } | undefined;
  return (
    cause?.retry?.kind === 'terminal' ||
    [
      'deepl_invalid_response',
      'deepl_text_too_large',
      'deepl_auth_failed',
      'deepl_quota_exceeded',
      'catalog_setup_required',
    ].includes(error.message)
  );
};

const fail = (code: string): never => {
  throw Object.assign(new Error(code), { cause: { retry: { kind: 'terminal' } } });
};

const restoreTranslation = (translated: string, tokens: string[], prefix: string): string => {
  let text = translated;
  if (/\{\{|\}\}|<[^>]*>/.test(text)) fail('deepl_invalid_response');
  for (const [tokenIndex, token] of tokens.entries()) {
    const sentinel = `${prefix}${tokenIndex + 1}Z`;
    if (text.split(sentinel).length !== 2) fail('deepl_invalid_response');
    text = text.replace(sentinel, () => token);
  }
  if (text.includes(prefix) || /\{\{|\}\}/.test(text.replace(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}/g, '')))
    fail('deepl_invalid_response');
  return text;
};
export const translateProtectedValues = async (
  values: readonly CatalogValue[],
  batchTransport: {
    maxItems: number;
    fits: (texts: string[]) => boolean;
    translate: (texts: string[]) => Promise<string[]>;
    skipWhitespace?: boolean;
  }
): Promise<CatalogValue[]> => {
  const prefix = `SVA${globalThis.crypto.randomUUID().replaceAll('-', '')}X`;
  const units = values.flatMap((value) => (typeof value === 'string' ? [value] : [...value]));
  if (!units.length || units.some((text) => text.includes(prefix))) fail('invalid_catalog');
  // Protect every occurrence, including repeated placeholders and literal markup.
  const protectedUnits = units
    .map((text) => {
      const tokens: string[] = [];
      const protectedText = text.replace(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}|<[^>]*>/g, (token) => {
        tokens.push(token);
        return `${prefix}${tokens.length}Z`;
      });
      return { text: protectedText, tokens };
    })
    .map((unit, index) => ({ ...unit, index }))
    .filter((unit) => (batchTransport.skipWhitespace ? unit.text.trim() : unit.text).length > 0);
  const translated = units.map((text) =>
    batchTransport.skipWhitespace && !text.trim() ? text : ''
  );
  if (protectedUnits.some((unit) => !batchTransport.fits([unit.text])))
    fail('deepl_text_too_large');
  let cursor = 0;
  while (cursor < protectedUnits.length) {
    const batch: string[] = [];
    while (
      cursor + batch.length < protectedUnits.length &&
      batch.length < batchTransport.maxItems
    ) {
      const next = protectedUnits[cursor + batch.length]!.text;
      if (!batchTransport.fits([...batch, next])) break;
      batch.push(next);
    }
    const result = await batchTransport.translate(batch);
    if (result.length !== batch.length) fail('deepl_invalid_response');
    for (const [index, entry] of result.entries()) {
      const unit = protectedUnits[cursor + index]!;
      translated[unit.index] = restoreTranslation(entry, unit.tokens, prefix);
    }
    cursor += batch.length;
  }
  let offset = 0;
  return values.map((value) =>
    typeof value === 'string'
      ? translated[offset++]!
      : translated.slice(offset, (offset += value.length))
  );
};
