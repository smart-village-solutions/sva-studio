import {
  isPluginOwnedMessageKey,
  type PluginTenantReadinessReadModel,
  type PluginTranslations,
} from '@sva/plugin-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCALE, getActiveLocale, setActiveLocale } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';
import { PluginReadinessCard } from './-instance-plugin-readiness-card';

const pluginTranslations: Readonly<Record<string, PluginTranslations>> = {
  ssf: {
    de: { ssf: { errors: { rootDatabaseNotConfigured: 'SSF-Root-Datenbank fehlt.' } } },
    en: { ssf: { errors: { rootDatabaseNotConfigured: 'SSF root database missing.' } } },
  },
  'english-only': {
    en: { englishOnly: { errors: { configurationBlocked: 'Configuration missing.' } } },
  },
  'speech-flow': {
    de: { speechFlow: { readiness: { configurationBlocked: 'Konfiguration fehlt.' } } },
    en: { speechFlow: { readiness: { configurationBlocked: 'Configuration missing.' } } },
  },
} as const;

const readLeaf = (resources: unknown, key: string): string | undefined =>
  key
    .split('.')
    .reduce<unknown>(
      (pointer, segment) => (pointer as Record<string, unknown> | undefined)?.[segment],
      resources
    ) as string | undefined;

// Plugin text is merged into the host catalog at runtime; the mock reads it per active locale.
vi.mock('../../../lib/plugins', () => ({
  resolveStudioPluginOwnedMessage: (pluginId: string, key: string | undefined) => {
    const translations = pluginTranslations[pluginId];
    if (!isPluginOwnedMessageKey(key, translations)) return undefined;
    return (
      readLeaf(translations?.[getActiveLocale()], key) ??
      readLeaf(translations?.[DEFAULT_LOCALE], key) ??
      key
    );
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    params: { jobId: string };
    to: string;
  }) => (
    <a href={to.replace('$jobId', params.jobId)} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  setActiveLocale('de');
  cleanup();
});

const pluginFixture = (
  overrides: Partial<PluginTenantReadinessReadModel> = {}
): PluginTenantReadinessReadModel => ({
  pluginId: 'speech-flow',
  activationPolicy: 'automatic',
  effectiveActive: true,
  accessState: 'active',
  status: 'blocked',
  evidenceState: 'valid',
  desiredOperation: 'reconcile',
  desiredGeneration: 2,
  completedGeneration: 1,
  checks: [
    {
      checkId: 'configuration',
      titleKey: 'plugins.speechFlow.readiness.configuration',
      required: true,
      repairOperation: 'reconcile',
      status: 'blocked',
    },
  ],
  updatedAt: '2026-08-30T10:00:00.000Z',
  ...overrides,
});

describe('PluginReadinessCard', () => {
  it('renders generic plugin readiness and starts only the declared repair operation', () => {
    const onRepair = vi.fn().mockResolvedValue(undefined);

    render(
      <PluginReadinessCard
        plugins={[pluginFixture()]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={onRepair}
      />
    );

    expect(screen.getByRole('heading', { name: 'speech-flow' })).toBeTruthy();
    expect(screen.getAllByText('Blockiert')).toHaveLength(2);
    expect(screen.getByText('Aktivierungsrichtlinie: Automatisch')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Reparatur Abgleich für Plugin speech-flow starten' })
    );

    expect(onRepair).toHaveBeenCalledWith('speech-flow', 'reconcile');
  });

  it('links an active lifecycle job through the existing monitoring route', () => {
    render(
      <PluginReadinessCard
        plugins={[pluginFixture({ activeJobId: 'job-42' })]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(
      screen
        .getByRole('link', { name: 'Aktiven Job für Plugin speech-flow öffnen' })
        .getAttribute('href')
    ).toBe('/monitoring/jobs/job-42');
    expect(
      (
        screen.getByRole('button', {
          name: 'Reparatur Abgleich für Plugin speech-flow starten',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('renders the generic controls in English when English is active', () => {
    setActiveLocale('en');

    render(
      <PluginReadinessCard
        plugins={[pluginFixture({ activeJobId: 'job-42' })]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Plugin readiness' })).toBeTruthy();
    expect(screen.getByText('Activation policy: Automatic')).toBeTruthy();
    expect(screen.getAllByText('Blocked')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Open active job for plugin speech-flow' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Start reconciliation repair for plugin speech-flow' })
    ).toBeTruthy();
  });

  it('does not offer a repair for ready checks and keeps loading and errors accessible', () => {
    const { rerender } = render(
      <PluginReadinessCard
        plugins={[
          pluginFixture({
            status: 'ready',
            checks: [
              {
                checkId: 'configuration',
                titleKey: 'plugins.speechFlow.readiness.configuration',
                required: true,
                repairOperation: 'reconcile',
                status: 'ready',
              },
            ],
          }),
        ]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <PluginReadinessCard
        plugins={[]}
        isLoading={true}
        activeAction={null}
        error={
          new IamHttpError({
            status: 503,
            code: 'plugin_tenant_lifecycle_start_failed',
            message: 'Dienst nicht verfügbar',
          })
        }
        onRepair={vi.fn()}
      />
    );

    expect(screen.getByRole('status').textContent).toContain('Plugin-Status wird geladen');
    expect(screen.getByRole('alert').textContent).toContain('Dienst nicht verfügbar');
  });

  it('offers repair after a terminal failure even when the last checks were ready', () => {
    const onRepair = vi.fn().mockResolvedValue(undefined);
    render(
      <PluginReadinessCard
        plugins={[
          pluginFixture({
            status: 'blocked',
            error: { code: 'reconcile_failed', retryKind: 'terminal' },
            activeJobId: undefined,
            checks: [
              {
                checkId: 'configuration',
                titleKey: 'plugins.speechFlow.readiness.configuration',
                required: true,
                repairOperation: 'reconcile',
                status: 'ready',
              },
            ],
          }),
        ]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={onRepair}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Reparatur Abgleich für Plugin speech-flow starten' })
    );
    expect(onRepair).toHaveBeenCalledWith('speech-flow', 'reconcile');
  });

  it('gives different repair operations distinct accessible names', () => {
    render(
      <PluginReadinessCard
        plugins={[
          pluginFixture({
            checks: [
              ...pluginFixture().checks,
              {
                checkId: 'provisioning',
                titleKey: 'plugins.speechFlow.readiness.configuration',
                required: true,
                repairOperation: 'provision',
                status: 'blocked',
              },
            ],
          }),
        ]}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Reparatur Abgleich für Plugin speech-flow starten' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Reparatur Bereitstellung für Plugin speech-flow starten',
      })
    ).toBeTruthy();
  });
  const ssfFailure = (messageKey?: string) =>
    pluginFixture({
      pluginId: 'ssf',
      status: 'blocked',
      activeJobId: undefined,
      error: {
        code: 'ssf.root-database-not-configured',
        ...(messageKey ? { messageKey } : {}),
        retryKind: 'terminal',
      },
    });

  const renderCard = (plugins: readonly PluginTenantReadinessReadModel[]) =>
    render(
      <PluginReadinessCard
        plugins={plugins}
        isLoading={false}
        activeAction={null}
        error={null}
        onRepair={vi.fn()}
      />
    );

  it('shows the plugin-owned repair hint of a terminal lifecycle failure with its code', () => {
    renderCard([ssfFailure('ssf.errors.rootDatabaseNotConfigured')]);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('SSF-Root-Datenbank fehlt.');
    expect(notice.textContent).toContain('Fehlercode: ssf.root-database-not-configured');
    expect(
      screen.getByRole('button', { name: 'Reparatur Abgleich für Plugin ssf starten' })
    ).toBeTruthy();
  });

  it('shows the repair hint in English when English is active', () => {
    setActiveLocale('en');
    renderCard([ssfFailure('ssf.errors.rootDatabaseNotConfigured')]);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('SSF root database missing.');
    expect(notice.textContent).toContain('Error code: ssf.root-database-not-configured');
  });

  it.each([
    ['a foreign-namespace key', 'speechFlow.readiness.configurationBlocked'],
    ['a host key', 'admin.instances.pluginReadiness.title'],
    ['an unknown own key', 'ssf.errors.doesNotExist'],
    ['free text', 'Set password=hunter2 and call +49 123'],
    ['no key', undefined],
  ])('uses the translated fallback for %s', (_label, messageKey) => {
    renderCard([ssfFailure(messageKey)]);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain(
      'Dieses Plugin meldet ein Lifecycle-Problem. Ein weiterer Hinweis liegt nicht vor.'
    );
    expect(notice.textContent).toContain('Fehlercode: ssf.root-database-not-configured');
    expect(notice.textContent).not.toContain('hunter2');
    expect(notice.textContent).not.toContain('Konfiguration fehlt.');
    expect(notice.textContent).not.toContain('Plugin-Betriebsbereitschaft');
  });

  it('uses the host fallback when an owned message has no active or fallback translation', () => {
    const messageKey = 'englishOnly.errors.configurationBlocked';
    renderCard([{ ...ssfFailure(messageKey), pluginId: 'english-only' }]);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Dieses Plugin meldet ein Lifecycle-Problem.');
    expect(notice.textContent).not.toContain(messageKey);
  });

  it('keeps an untrusted error code out of the notice', () => {
    renderCard([
      pluginFixture({
        activeJobId: undefined,
        error: { code: '<img src=x> token=abc', retryKind: 'terminal' },
      }),
    ]);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Dieses Plugin meldet ein Lifecycle-Problem.');
    expect(notice.textContent).not.toContain('token=abc');
  });

  it('hides the previous generation error while a new lifecycle generation is pending', () => {
    renderCard([
      pluginFixture({
        pluginId: 'ssf',
        status: 'pending',
        activeJobId: undefined,
        error: {
          code: 'ssf.root-database-not-configured',
          messageKey: 'ssf.errors.rootDatabaseNotConfigured',
        },
      }),
    ]);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('SSF-Root-Datenbank fehlt.')).toBeNull();
  });

  it('shows a neutral notice for invalid readiness evidence without a failed job', () => {
    renderCard([
      pluginFixture({
        status: 'degraded',
        evidenceState: 'invalid',
        activeJobId: undefined,
        error: { code: 'plugin_tenant_readiness_evidence_invalid' },
      }),
    ]);

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Dieses Plugin meldet ein Lifecycle-Problem.');
    expect(notice.textContent).not.toContain('fehlgeschlagen');
    expect(notice.className).not.toContain('destructive');
    expect(notice.textContent).toContain('Fehlercode: plugin_tenant_readiness_evidence_invalid');
  });

  it('renders no lifecycle notice without a lifecycle error', () => {
    renderCard([pluginFixture({ activeJobId: undefined })]);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders only plugin-owned readiness check messages', () => {
    renderCard([
      pluginFixture({
        checks: [
          {
            checkId: 'configuration',
            titleKey: 'plugins.speechFlow.readiness.configuration',
            required: true,
            status: 'blocked',
            messageKey: 'speechFlow.readiness.configurationBlocked',
          },
          {
            checkId: 'branding',
            titleKey: 'plugins.speechFlow.readiness.branding',
            required: false,
            status: 'degraded',
            messageKey: 'Please e-mail your API key to support',
          },
          {
            checkId: 'login',
            titleKey: 'plugins.speechFlow.readiness.login',
            required: false,
            status: 'degraded',
            messageKey: 'ssf.errors.rootDatabaseNotConfigured',
          },
        ],
      }),
    ]);

    expect(screen.getByText('Konfiguration fehlt.')).toBeTruthy();
    expect(
      screen.getAllByText('Das Plugin hat einen Hinweis gemeldet, der nicht angezeigt werden kann.')
    ).toHaveLength(2);
    expect(screen.queryByText(/API key/)).toBeNull();
    expect(screen.queryByText('SSF-Root-Datenbank fehlt.')).toBeNull();
  });
});
