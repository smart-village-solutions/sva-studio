import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  readSsfSystemOverrides,
  replaceSsfSystemConfiguration,
  replaceSsfTenantConfiguration,
  SsfSystemLocaleInUseError,
  SsfTenantDefaultLocaleUnavailableError,
} from '../src/admin-repository.js';

const systemInput = {
  defaultLocale: 'de-DE' as const,
  conversationContentStorageMode: 'ask' as const,
  locales: ['de-DE', 'en'].map((locale) => ({
    locale,
    available: locale === 'de-DE',
    authenticatedHomeExplanationHtml: '<p>Home</p>',
    guestExplanationHtml: '<p>Guest</p>',
    conversationContentStorageQuestionHtml: '<p>Store?</p>',
  })),
};

const poolWithClient = (query: ReturnType<typeof vi.fn>) => {
  const client = { query, release: vi.fn() } as unknown as PoolClient;
  return { pool: { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, client };
};

describe('SSF administration repository', () => {
  it('maps stored system settings and locales', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              default_locale: 'de-DE',
              conversation_content_storage_allowed: true,
              conversation_content_storage_mode: 'ask',
              logo_media_reference: null,
              icon_media_reference: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              locale: 'de-DE',
              available: true,
              authenticated_home_explanation_html: '<p>Home</p>',
              guest_explanation_html: '<p>Guest</p>',
              conversation_content_storage_question_html: '<p>Store?</p>',
            },
          ],
        }),
    } as unknown as Pool;

    await expect(readSsfSystemOverrides(pool)).resolves.toMatchObject({
      serverSettings: { defaultLocale: 'de-DE' },
      serverLocales: [{ locale: 'de-DE', available: true }],
    });
  });

  it('replaces system settings and locale rows in one transaction', async () => {
    const query = vi
      .fn()
      .mockImplementation((sql: string) =>
        Promise.resolve({ rows: sql.includes('tenant_settings') ? [] : [] })
      );
    const { pool, client } = poolWithClient(query);

    await replaceSsfSystemConfiguration(pool, systemInput);

    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(
      query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO ssf.server_locales'))
    ).toHaveLength(2);
  });

  it('rolls back when a disabled locale remains a tenant default', async () => {
    const query = vi
      .fn()
      .mockImplementation((sql: string) =>
        Promise.resolve({ rows: sql.includes('tenant_settings') ? [{ exists: 1 }] : [] })
      );
    const { pool, client } = poolWithClient(query);

    await expect(replaceSsfSystemConfiguration(pool, systemInput)).rejects.toBeInstanceOf(
      SsfSystemLocaleInUseError
    );
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('validates and stores tenant settings and locale rows transactionally', async () => {
    const query = vi
      .fn()
      .mockImplementation((sql: string) =>
        Promise.resolve({ rows: sql.includes('SELECT available') ? [{ available: true }] : [] })
      );
    const { pool } = poolWithClient(query);
    const input = {
      defaultLocale: 'de-DE' as const,
      conversationContentStorageMode: null,
      locales: ['de-DE', 'en'].map((locale) => ({
        locale,
        enabled: null,
        authenticatedHomeExplanationHtml: null,
        guestExplanationHtml: null,
        conversationContentStorageQuestionHtml: null,
      })),
    };

    await replaceSsfTenantConfiguration(pool, 'tenant-a', input);
    expect(query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects an unavailable tenant default', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { pool } = poolWithClient(query);
    const input = {
      defaultLocale: 'en' as const,
      conversationContentStorageMode: null,
      locales: ['de-DE', 'en'].map((locale) => ({
        locale,
        enabled: null,
        authenticatedHomeExplanationHtml: null,
        guestExplanationHtml: null,
        conversationContentStorageQuestionHtml: null,
      })),
    };

    await expect(replaceSsfTenantConfiguration(pool, 'tenant-a', input)).rejects.toBeInstanceOf(
      SsfTenantDefaultLocaleUnavailableError
    );
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});
