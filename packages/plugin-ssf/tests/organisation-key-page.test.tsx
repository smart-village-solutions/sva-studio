// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  StudioEditorLeaveGuardProvider,
  type StudioEditorLeaveGuardRegister,
} from '@sva/studio-ui-react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { publishSessionAccessSnapshot, readSessionAccessSnapshot } from '@sva/plugin-sdk';
import * as forms from '../src/admin.organisation-keys.page.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const v = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/lifecycle_v2.json'), 'utf8')
);
const api = vi.hoisted(() => vi.fn());
vi.mock('../src/organisation-key-client.js', async (original) => ({
  ...(await original<typeof import('../src/organisation-key-client.js')>()),
  requestOperation: api,
}));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (k: string) => k,
}));
vi.mock('../src/organisation-key-crypto.js', async (original) => ({
  ...(await original<typeof import('../src/organisation-key-crypto.js')>()),
  generateOrganisationKey: async () => ({ publicKey: v.organisationPublicKey }),
  createOrganisationKeyFile: async () => JSON.stringify({ privateKeyPkcs8: 'LOCAL-ONLY' }),
  importOrganisationKey: async () => ({}),
  activationProof: async () => v.activationProof,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('gates activation on custody and sends only proof, then reconciles authoritative metadata', async () => {
  api.mockImplementation(async (op: string) =>
    op === 'list'
      ? { activeKeyId: null, keys: [] }
      : op === 'prepareKey'
        ? {
            keyId: v.organisationKeyId,
            version: 2,
            fingerprint: v.organisationFingerprint,
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            preparationId: v.preparationId,
            challengeEnvelope: v.activationChallenge,
          }
        : { keyId: v.organisationKeyId, state: 'active' }
  );
  expect(forms.OrganisationKeyForm).toBeTypeOf('function');
  render(<forms.OrganisationKeyForm tenantId={v.tenantId} actor={v.actorSub} />);
  fireEvent.click(await screen.findByRole('button', { name: 'keys.create' }));
  const activate = await screen.findByRole('button', { name: 'keys.activate' });
  expect((activate as HTMLButtonElement).disabled).toBe(true);
  const saved = screen.getByRole('checkbox', { name: 'keys.saved' }) as HTMLInputElement;
  expect(saved.disabled).toBe(true);
  URL.createObjectURL = vi.fn(() => 'blob:key-fixture');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole('button', { name: 'keys.download' }));
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  fireEvent.click(saved);
  fireEvent.click(activate);
  await waitFor(() => expect(api.mock.calls.filter((c) => c[0] === 'activate')).toHaveLength(1));
  expect(api.mock.calls.find((c) => c[0] === 'activate')?.[1]).toMatchObject({
    id: v.preparationId,
    body: { proof: v.activationProof, savedConfirmation: true },
  });
  expect(JSON.stringify(api.mock.calls)).not.toContain('LOCAL-ONLY');
  await waitFor(() => expect(api.mock.calls.filter((c) => c[0] === 'list')).toHaveLength(2));
});

it('refreshes public key state when a concurrent activation invalidates a preparation request', async () => {
  api.mockImplementation(async (op: string) => {
    if (op === 'list') return { activeKeyId: null, keys: [] };
    throw new Error('KEY_VERSION_CHANGED');
  });
  render(<forms.OrganisationKeyForm tenantId={v.tenantId} actor={v.actorSub} />);
  fireEvent.click(await screen.findByRole('button', { name: 'keys.create' }));
  await screen.findByText('keys.errors.KEY_VERSION_CHANGED');
  expect(api.mock.calls.filter(([op]) => op === 'list')).toHaveLength(2);
  expect(api.mock.calls.some(([op]) => op === 'activate')).toBe(false);
});

it('moves focus to export and clears the local print sheet on navigation discard', async () => {
  const { renderToString } = await import('react-dom/server');
  api.mockImplementation(async (op: string) => {
    if (op === 'list') return { activeKeyId: null, keys: [] };
    return {
      keyId: v.organisationKeyId,
      version: 2,
      fingerprint: v.organisationFingerprint,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      preparationId: v.preparationId,
      challengeEnvelope: v.activationChallenge,
    };
  });
  const app = <forms.OrganisationKeyForm tenantId={v.tenantId} actor={v.actorSub} />;
  expect(renderToString(app)).not.toContain('LOCAL-ONLY');
  const register = vi.fn<StudioEditorLeaveGuardRegister>(() => () => undefined);
  render(
    <StudioEditorLeaveGuardProvider register={register}>{app}</StudioEditorLeaveGuardProvider>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'keys.create' }));
  const download = await screen.findByRole('button', { name: 'keys.download' });
  expect(document.activeElement).toBe(download);
  const guard = register.mock.calls.at(-1);
  if (!guard) throw new Error('Missing custody leave guard');
  const [dirty, actions] = guard;
  expect(dirty()).toBe(true);
  const append = document.body.appendChild.bind(document.body);
  const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    const appended = append(node);
    if (node instanceof HTMLIFrameElement && node.contentWindow) {
      node.contentWindow.focus = vi.fn();
      node.contentWindow.print = vi.fn();
    }
    return appended;
  });
  try {
    fireEvent.click(screen.getByRole('button', { name: 'keys.print' }));
    const sheet = document.querySelector('iframe');
    expect(sheet?.contentDocument?.body.textContent).toContain(
      Buffer.from(JSON.stringify({ privateKeyPkcs8: 'LOCAL-ONLY' })).toString('base64url')
    );
    expect(JSON.stringify(api.mock.calls)).not.toContain('LOCAL-ONLY');
    act(() => actions?.discard?.());
    expect(dirty()).toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
    expect(api.mock.calls.some(([op]) => op === 'abandon')).toBe(true);
  } finally {
    appendSpy.mockRestore();
  }
});

it('clears the preparation on tenant switch and blocks the workflow after logout', async () => {
  const original = readSessionAccessSnapshot();
  const snapshot = {
    isResolved: true,
    instanceId: v.tenantId,
    subjectId: v.actorSub,
    roles: [],
    assignedModules: [],
    permissionActions: ['ssf.configuration.tenant.manage'],
  };
  api.mockImplementation(async (op: string) =>
    op === 'list'
      ? { keys: [], activeKeyId: null }
      : {
          keyId: v.organisationKeyId,
          version: 2,
          fingerprint: v.organisationFingerprint,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          preparationId: v.preparationId,
          challengeEnvelope: v.activationChallenge,
        }
  );
  try {
    act(() => publishSessionAccessSnapshot(snapshot));
    render(<forms.SsfOrganisationKeysPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'keys.create' }));
    await screen.findByRole('button', { name: 'keys.activate' });
    act(() => publishSessionAccessSnapshot({ ...snapshot, instanceId: 'other-tenant' }));
    await screen.findByRole('button', { name: 'keys.create' });
    expect(screen.queryByRole('button', { name: 'keys.activate' })).toBeNull();
    act(() =>
      publishSessionAccessSnapshot({ ...snapshot, subjectId: undefined, permissionActions: [] })
    );
    await screen.findByText('keys.errors.AUTHENTICATION_REQUIRED');
    const login = screen.getByRole('link', { name: 'keys.login' });
    expect(login.getAttribute('href')).toBe('/auth/login?returnTo=%2F');
    expect(api.mock.calls.some(([op]) => op === 'activate')).toBe(false);
  } finally {
    act(() => publishSessionAccessSnapshot(original));
  }
});

it.each(['late-success', 'lost-response', 'history-reconciled', 'rejected', 'unsubmitted-expiry'])(
  'handles preparation expiry and authoritative activation outcomes: %s',
  async (scenario) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const originalList = { activeKeyId: null, keys: [] },
      active = {
        keyId: v.organisationKeyId,
        state: 'active',
        version: 2,
        fingerprint: v.organisationFingerprint,
      };
    const response = Promise.withResolvers<unknown>();
    let sends = 0;
    api.mockImplementation(async (op: string) => {
      if (op === 'list')
        return sends > 1 || (['late-success', 'history-reconciled'].includes(scenario) && sends > 0)
          ? { activeKeyId: active.keyId, keys: [active] }
          : originalList;
      if (op === 'prepareKey')
        return {
          preparationId: v.preparationId,
          keyId: active.keyId,
          version: 2,
          fingerprint: active.fingerprint,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        };
      if (op === 'activate') return ++sends === 1 ? response.promise : active;
    });
    try {
      render(<forms.OrganisationKeyForm tenantId={v.tenantId} actor={v.actorSub} />);
      fireEvent.click(await screen.findByRole('button', { name: 'keys.create' }));
      URL.createObjectURL = vi.fn(() => 'blob:fixture');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      fireEvent.click(await screen.findByRole('button', { name: 'keys.download' }));
      if (scenario === 'unsubmitted-expiry') {
        await act(async () => {
          vi.advanceTimersByTime(300005);
        });
        await screen.findByText('keys.errors.PREPARATION_EXPIRED');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
        expect(screen.queryByRole('button', { name: 'keys.activate' })).toBeNull();
        expect(sends).toBe(0);
        return;
      }
      fireEvent.click(screen.getByRole('checkbox', { name: 'keys.saved' }));
      fireEvent.click(screen.getByRole('button', { name: 'keys.activate' }));
      await waitFor(() => expect(sends).toBe(1));
      if (scenario === 'history-reconciled') {
        await act(async () => {
          response.resolve({ ...active, state: 'prepared' });
        });
        await screen.findByText('keys.activated');
        expect(sends).toBe(1);
        expect(screen.queryByRole('button', { name: 'keys.retryConfirmed' })).toBeNull();
        return;
      }
      if (scenario === 'rejected') {
        await act(async () => {
          response.reject(new Error('PERMISSION_REQUIRED'));
        });
        await screen.findByText('keys.errors.PERMISSION_REQUIRED');
        expect(screen.queryByRole('button', { name: 'keys.retryConfirmed' })).toBeNull();
        expect(screen.queryByText('keys.activated')).toBeNull();
        return;
      }
      if (scenario === 'lost-response')
        await act(async () => {
          response.reject(new Error('RECORDING_UNAVAILABLE'));
        });
      await act(async () => {
        vi.advanceTimersByTime(300005);
      });
      expect(screen.queryByText('keys.errors.PREPARATION_EXPIRED')).toBeNull();
      expect(screen.queryByRole('button', { name: 'keys.download' })).toBeNull();
      if (scenario === 'late-success')
        await act(async () => {
          response.resolve(active);
        });
      else {
        act(() => {
          window.dispatchEvent(new Event('pagehide'));
        });
        fireEvent.click(await screen.findByRole('button', { name: 'keys.retryConfirmed' }));
        await waitFor(() => expect(sends).toBe(2));
        const calls = api.mock.calls.filter(([op]) => op === 'activate');
        expect(calls[1]?.[1].body).toEqual(calls[0]?.[1].body);
        expect(calls[1]?.[1].id).toBe(calls[0]?.[1].id);
      }
      await screen.findByText('keys.activated');
      expect(api.mock.calls.filter(([op]) => op === 'prepareKey')).toHaveLength(1);
      expect(api.mock.calls.some(([op]) => op === 'abandon')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  }
);

it('offers a history reload after a failed read without starting a preparation', async () => {
  api
    .mockRejectedValueOnce(new Error('RECORDING_UNAVAILABLE'))
    .mockResolvedValue({ keys: [], activeKeyId: null });
  render(<forms.OrganisationKeyForm tenantId={v.tenantId} actor={v.actorSub} />);
  fireEvent.click(await screen.findByRole('button', { name: 'keys.reload' }));
  await screen.findByRole('button', { name: 'keys.create' });
  expect(api.mock.calls.map(([op]) => op)).toEqual(['list', 'list']);
});
