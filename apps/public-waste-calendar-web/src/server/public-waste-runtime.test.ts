import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPublicWasteRuntime } from './public-waste-runtime.js';

const createAssetsDir = async (): Promise<string> => {
  const assetsDir = await mkdtemp(join(tmpdir(), 'public-waste-runtime-'));
  await writeFile(join(assetsDir, 'index.html'), '<!doctype html><html><body>Public Waste</body></html>', 'utf8');
  return assetsDir;
};

const cleanupPaths = new Set<string>();

afterEach(async () => {
  await Promise.all([...cleanupPaths].map(async (path) => rm(path, { recursive: true, force: true })));
  cleanupPaths.clear();
});

describe('public waste runtime', () => {
  it('returns 200 for /health/live when config is valid', async () => {
    const assetsDir = await createAssetsDir();
    cleanupPaths.add(assetsDir);

    const runtime = await createPublicWasteRuntime({
      assetsDir,
      env: {
        PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz',
        PUBLIC_WASTE_DATABASE_URL: 'postgres://example',
        PUBLIC_WASTE_SCHEMA_NAME: 'public',
      },
    });

    const response = await runtime.handle(new Request('http://localhost/health/live'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      app: 'public-waste-calendar-web',
      instanceId: 'bb-prignitz',
    });

    await runtime.dispose();
  });

  it('returns 500 for API requests when runtime config is invalid', async () => {
    const assetsDir = await createAssetsDir();
    cleanupPaths.add(assetsDir);

    const runtime = await createPublicWasteRuntime({
      assetsDir,
      env: {},
    });

    const response = await runtime.handle(new Request('http://localhost/api/public-waste/selection'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_config',
    });

    await runtime.dispose();
  });

  it('renders the DOI activation page for configured reminder paths', async () => {
    const assetsDir = await createAssetsDir();
    cleanupPaths.add(assetsDir);

    const poolConnect = vi.fn().mockResolvedValue({
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              id: 'subscription-1',
              status: 'pending',
              location_label: 'Perleberg, Ackerstr. 12',
              expires_at: '2026-06-16T19:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    });

    const runtime = await createPublicWasteRuntime({
      assetsDir,
      env: {
        PUBLIC_WASTE_CONFIG_JSON: JSON.stringify({
          instanceId: 'bb-prignitz',
          supabase: {
            databaseUrl: 'postgres://example',
            schemaName: 'public',
          },
          emailReminderConfig: {
            enabled: true,
            publicSignupEnabled: true,
            transportId: 'mail-1',
            publicBaseUrl: 'https://example.invalid',
            doiConfirmPath: '/erinnerungen/bestaetigen',
            unsubscribePath: '/erinnerungen/abmelden',
            fromName: 'Abfallwirtschaft',
            fromEmail: 'abfall@example.invalid',
            privacyPolicyUrl: 'https://example.invalid/datenschutz',
            imprintUrl: 'https://example.invalid/impressum',
            consentLabel: 'Ich stimme zu.',
            consentVersion: 'v1',
            doiSubjectTemplate: 'Bitte bestaetigen',
            doiIntroText: 'Bitte bestaetigen.',
            doiButtonLabel: 'Bestaetigen',
            doiSuccessHeadline: 'Aktiviert',
            doiSuccessBody: 'Ihre Erinnerung ist aktiv.',
            reminderSubjectTemplate: 'Erinnerung',
            reminderIntroTemplate: 'Nicht vergessen.',
            unsubscribeLinkLabel: 'Abmelden',
            unsubscribeSuccessHeadline: 'Abgemeldet',
            unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
            maxSubscriptionsPerEmailAndLocation: 3,
            signupRateLimitPerIpPerHour: 10,
            signupRateLimitPerEmailPerHour: 3,
            doiTokenTtlHours: 24,
            pendingSubscriptionTtlHours: 48,
            materializationLookaheadDays: 7,
          },
        }),
      },
      createRepository: async () => ({
        repository: {
          listSelectionOptions: vi.fn(),
          loadCalendarEntries: vi.fn(),
          loadSelectionSummary: vi.fn(),
          loadReminderSignupOptions: vi.fn(),
        },
        pool: {
          connect: poolConnect,
        } as never,
        schemaName: 'public',
        dispose: async () => {},
      }),
    });

    const response = await runtime.handle(
      new Request('http://localhost/erinnerungen/bestaetigen?token=confirm-token')
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Aktiviert');

    await runtime.dispose();
  });

  it('enforces the reminder subscription cap inside the signup transaction with an advisory lock', async () => {
    const assetsDir = await createAssetsDir();
    cleanupPaths.add(assetsDir);

    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ total: 0 }] })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    const poolConnect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });

    const runtime = await createPublicWasteRuntime({
      assetsDir,
      env: {
        PUBLIC_WASTE_CONFIG_JSON: JSON.stringify({
          instanceId: 'bb-prignitz',
          supabase: {
            databaseUrl: 'postgres://example',
            schemaName: 'public',
          },
          emailReminderConfig: {
            enabled: true,
            publicSignupEnabled: true,
            transportId: 'mail-1',
            publicBaseUrl: 'https://example.invalid',
            doiConfirmPath: '/erinnerungen/bestaetigen',
            unsubscribePath: '/erinnerungen/abmelden',
            fromName: 'Abfallwirtschaft',
            fromEmail: 'abfall@example.invalid',
            privacyPolicyUrl: 'https://example.invalid/datenschutz',
            imprintUrl: 'https://example.invalid/impressum',
            consentLabel: 'Ich stimme zu.',
            consentVersion: 'v1',
            doiSubjectTemplate: 'Bitte bestaetigen',
            doiIntroText: 'Bitte bestaetigen.',
            doiButtonLabel: 'Bestaetigen',
            doiSuccessHeadline: 'Aktiviert',
            doiSuccessBody: 'Ihre Erinnerung ist aktiv.',
            reminderSubjectTemplate: 'Erinnerung',
            reminderIntroTemplate: 'Nicht vergessen.',
            unsubscribeLinkLabel: 'Abmelden',
            unsubscribeSuccessHeadline: 'Abgemeldet',
            unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
            maxSubscriptionsPerEmailAndLocation: 3,
            signupRateLimitPerIpPerHour: 10,
            signupRateLimitPerEmailPerHour: 3,
            doiTokenTtlHours: 24,
            pendingSubscriptionTtlHours: 48,
            materializationLookaheadDays: 7,
          },
        }),
      },
      createRepository: async () => ({
        repository: {
          listSelectionOptions: vi.fn(),
          loadCalendarEntries: vi.fn(),
          loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
          loadReminderSignupOptions: vi.fn().mockResolvedValue([
            {
              id: 'bio',
              label: 'Bioabfall',
              slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
            },
          ]),
        },
        pool: {
          connect: poolConnect,
        } as never,
        schemaName: 'public',
        dispose: async () => {},
      }),
    });

    const response = await runtime.handle(
      new Request('http://localhost/api/public-waste/reminder-signups', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          selection: {
            cityId: '22222222-2222-4222-8222-222222222222',
            streetId: '33333333-3333-4333-8333-333333333333',
          },
          email: 'person@example.invalid',
          items: [{ fractionId: 'bio', slotId: 'bio:first' }],
          consentAccepted: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'pending' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), expect.any(Array));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)::int AS total'), expect.any(Array));

    await runtime.dispose();
  });
});
