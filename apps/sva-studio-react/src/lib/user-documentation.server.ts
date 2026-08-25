import { createSdkLogger } from '@sva/server-runtime';

import pageCatalog from '../../../../docs/user-documentation/page-catalog.json';

const MANIFEST_MAX_BYTES = 512 * 1024;
const MARKDOWN_MAX_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const knownPageIds = new Set(pageCatalog.pages.map((page) => page.id));
let logger: ReturnType<typeof createSdkLogger> | undefined;

type DocumentationManifestPage = Readonly<{
  markdownPath: string;
  websiteUrl: string;
}>;

type DocumentationManifest = Readonly<{
  schemaVersion: 1;
  pages: Readonly<Record<string, DocumentationManifestPage>>;
}>;

export type UserDocumentationPayload = Readonly<{
  id: string;
  markdown: string;
  documentationBaseUrl: string;
  websiteUrl: string;
  etag?: string;
}>;

export type UserDocumentationErrorCode =
  | 'documentation_not_configured'
  | 'documentation_page_unknown'
  | 'documentation_page_missing'
  | 'documentation_upstream_unavailable'
  | 'documentation_upstream_invalid';

export class UserDocumentationError extends Error {
  constructor(
    readonly code: UserDocumentationErrorCode,
    readonly status: number
  ) {
    super(code);
    this.name = 'UserDocumentationError';
  }
}

const parseBaseUrl = (value: string | undefined): URL => {
  if (!value) {
    throw new UserDocumentationError('documentation_not_configured', 503);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UserDocumentationError('documentation_not_configured', 503);
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new UserDocumentationError('documentation_not_configured', 503);
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}/`;
  return url;
};

const resolveAllowedUrl = (value: string, baseUrl: URL): URL => {
  const resolved = new URL(value, baseUrl);
  if (
    resolved.origin !== baseUrl.origin ||
    !resolved.pathname.startsWith(baseUrl.pathname) ||
    resolved.username !== '' ||
    resolved.password !== ''
  ) {
    throw new UserDocumentationError('documentation_upstream_invalid', 502);
  }
  return resolved;
};

const fetchLimited = async (
  url: URL,
  input: {
    readonly contentTypes: readonly string[];
    readonly maxBytes: number;
    readonly fetch: typeof fetch;
    readonly timeoutMs: number;
  }
): Promise<{ readonly body: string; readonly etag?: string }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await input.fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: input.contentTypes.join(', ') },
    });
    if (!response.ok || response.status >= 300) {
      throw new UserDocumentationError('documentation_upstream_unavailable', 502);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!input.contentTypes.includes(contentType)) {
      throw new UserDocumentationError('documentation_upstream_invalid', 502);
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
      throw new UserDocumentationError('documentation_upstream_invalid', 502);
    }
    if (!response.body) {
      throw new UserDocumentationError('documentation_upstream_invalid', 502);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > input.maxBytes) {
        controller.abort();
        await reader.cancel().catch(() => undefined);
        throw new UserDocumentationError('documentation_upstream_invalid', 502);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const etag = response.headers.get('etag')?.trim();
    return {
      body: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      ...(etag ? { etag } : {}),
    };
  } catch (error) {
    if (error instanceof UserDocumentationError) {
      throw error;
    }
    throw new UserDocumentationError(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'documentation_upstream_unavailable'
        : 'documentation_upstream_invalid',
      502
    );
  } finally {
    clearTimeout(timeout);
  }
};

const parseManifest = (body: string, baseUrl: URL): DocumentationManifest => {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new UserDocumentationError('documentation_upstream_invalid', 502);
  }
  if (!value || typeof value !== 'object' || (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new UserDocumentationError('documentation_upstream_invalid', 502);
  }
  const pages = (value as { pages?: unknown }).pages;
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) {
    throw new UserDocumentationError('documentation_upstream_invalid', 502);
  }
  for (const entry of Object.values(pages)) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { markdownPath?: unknown }).markdownPath !== 'string' ||
      typeof (entry as { websiteUrl?: unknown }).websiteUrl !== 'string'
    ) {
      throw new UserDocumentationError('documentation_upstream_invalid', 502);
    }
    resolveAllowedUrl((entry as DocumentationManifestPage).markdownPath, baseUrl);
    resolveAllowedUrl((entry as DocumentationManifestPage).websiteUrl, baseUrl);
  }
  return value as DocumentationManifest;
};

export const loadUserDocumentation = async (
  pageId: string,
  options: Readonly<{ baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number }> = {}
): Promise<UserDocumentationPayload> => {
  if (!knownPageIds.has(pageId)) {
    throw new UserDocumentationError('documentation_page_unknown', 404);
  }
  const baseUrl = parseBaseUrl(options.baseUrl ?? process.env.SVA_DOCUMENTATION_BASE_URL);
  const request = options.fetch ?? globalThis.fetch;
  const manifestResponse = await fetchLimited(resolveAllowedUrl('manifest.json', baseUrl), {
    contentTypes: ['application/json'],
    maxBytes: MANIFEST_MAX_BYTES,
    fetch: request,
    timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  });
  const manifest = parseManifest(manifestResponse.body, baseUrl);
  const page = manifest.pages[pageId];
  if (!page) {
    throw new UserDocumentationError('documentation_page_missing', 404);
  }
  const markdownResponse = await fetchLimited(resolveAllowedUrl(page.markdownPath, baseUrl), {
    contentTypes: ['text/markdown', 'text/plain'],
    maxBytes: MARKDOWN_MAX_BYTES,
    fetch: request,
    timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  });
  return {
    id: pageId,
    markdown: markdownResponse.body,
    documentationBaseUrl: baseUrl.toString(),
    websiteUrl: resolveAllowedUrl(page.websiteUrl, baseUrl).toString(),
    ...(markdownResponse.etag ? { etag: markdownResponse.etag } : {}),
  };
};

export const logUserDocumentationError = (pageId: string, error: UserDocumentationError): void => {
  logger ??= createSdkLogger({ component: 'user-documentation' });
  logger.warn('Anwenderdokumentation konnte nicht geladen werden', {
    operation: 'user_documentation_load',
    page_id: pageId,
    reason_code: error.code,
    http_status: error.status,
  });
};
